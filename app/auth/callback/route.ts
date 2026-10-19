import {
    createServerClient,
} from "@supabase/ssr";

import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    RESUME_MEME_COOKIE,
} from "@/app/lib/pendingMeme";


export const dynamic =
    "force-dynamic";

export const revalidate =
    0;


/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type CookieToSet = {
    name: string;

    value: string;

    options?: Parameters<
        NextResponse["cookies"]["set"]
    >[2];
};


/*
 * =========================================================
 * DEFAULT DISPLAY NAME
 * =========================================================
 *
 * example:
 *
 * jialangzheng@gmail.com
 *
 * ->
 *
 * jialangzheng
 */

function getDefaultDisplayName(
    email:
        | string
        | null
        | undefined
) {
    if (!email) {
        return "Meme user";
    }

    const emailName =
        email
            .split("@")[0]
            ?.trim();

    return (
        emailName ||
        "Meme user"
    );
}


/*
 * =========================================================
 * DETERMINE PUBLIC APP ORIGIN
 * =========================================================
 *
 * On Vercel, request.url is not always the
 * safest source for the public hostname.
 *
 * Prefer x-forwarded-host in production.
 */

function getAppOrigin(
    request: NextRequest
) {
    const requestUrl =
        new URL(
            request.url
        );

    if (
        process.env.NODE_ENV ===
        "development"
    ) {
        return requestUrl.origin;
    }

    const forwardedHost =
        request.headers.get(
            "x-forwarded-host"
        );

    const forwardedProto =
        request.headers.get(
            "x-forwarded-proto"
        ) ?? "https";

    if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
    }

    return requestUrl.origin;
}


/*
 * =========================================================
 * CREATE REDIRECT AND EXPLICITLY ATTACH AUTH COOKIES
 * =========================================================
 */

function createRedirect(
    destination: string,

    authCookies:
    CookieToSet[]
) {
    const response =
        NextResponse.redirect(
            destination
        );

    /*
     * THIS IS THE IMPORTANT PART.
     *
     * Explicitly attach every cookie produced
     * by exchangeCodeForSession() to the actual
     * redirect response that reaches Chrome.
     */

    authCookies.forEach(
        ({
             name,
             value,
             options,
         }) => {
            response.cookies.set(
                name,
                value,
                options
            );
        }
    );

    response.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
    );

    response.headers.set(
        "Pragma",
        "no-cache"
    );

    return response;
}


/*
 * =========================================================
 * CALLBACK
 * =========================================================
 */

export async function GET(
    request: NextRequest
) {
    const requestUrl =
        new URL(
            request.url
        );

    const appOrigin =
        getAppOrigin(
            request
        );

    const code =
        requestUrl.searchParams.get(
            "code"
        );


    /*
     * =====================================================
     * NO CODE
     * =====================================================
     */

    if (!code) {
        return NextResponse.redirect(
            `${appOrigin}/login?error=missing_code`
        );
    }


    /*
     * =====================================================
     * COLLECT SESSION COOKIES
     * =====================================================
     *
     * Instead of relying on Next's cookies()
     * abstraction, collect exactly what
     * Supabase wants to set.
     */

    const authCookies:
        CookieToSet[] =
        [];


    const supabase =
        createServerClient(
            process.env
                .NEXT_PUBLIC_SUPABASE_URL!,

            process.env
                .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,

            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },

                    setAll(
                        cookiesToSet
                    ) {
                        cookiesToSet.forEach(
                            ({
                                 name,
                                 value,
                                 options,
                             }) => {
                                /*
                                 * Keep request cookies
                                 * synchronized inside this
                                 * callback request.
                                 */

                                request.cookies.set(
                                    name,
                                    value
                                );

                                /*
                                 * Save everything so we can
                                 * explicitly attach it to the
                                 * final redirect response.
                                 */

                                const existingIndex =
                                    authCookies.findIndex(
                                        (
                                            cookie
                                        ) =>
                                            cookie.name ===
                                            name
                                    );

                                const nextCookie:
                                    CookieToSet =
                                    {
                                        name,
                                        value,
                                        options,
                                    };

                                if (
                                    existingIndex >=
                                    0
                                ) {
                                    authCookies[
                                        existingIndex
                                        ] =
                                        nextCookie;
                                } else {
                                    authCookies.push(
                                        nextCookie
                                    );
                                }
                            }
                        );
                    },
                },
            }
        );


    /*
     * =====================================================
     * EXCHANGE GOOGLE OAUTH CODE
     * =====================================================
     */

    const {
        data:
            exchangeData,

        error:
            exchangeError,
    } =
        await supabase.auth
            .exchangeCodeForSession(
                code
            );


    if (
        exchangeError ||
        !exchangeData.session
    ) {
        console.error(
            "OAuth exchange failed:",
            exchangeError
        );

        return createRedirect(
            `${appOrigin}/login?error=oauth`,

            authCookies
        );
    }


    /*
     * =====================================================
     * VERIFY USER
     * =====================================================
     */

    const {
        data: {
            user,
        },

        error:
            userError,
    } =
        await supabase.auth.getUser();


    if (
        userError ||
        !user
    ) {
        console.error(
            "OAuth session created but user verification failed:",
            userError
        );

        return createRedirect(
            `${appOrigin}/login?error=session`,

            authCookies
        );
    }


    /*
     * =====================================================
     * PROFILE DEFAULT NAME
     * =====================================================
     */

    const defaultDisplayName =
        getDefaultDisplayName(
            user.email
        );


    const {
        data:
            existingProfile,

        error:
            profileReadError,
    } =
        await supabase
            .from(
                "profiles"
            )
            .select(`
                id,
                first_name,
                last_name
            `)
            .eq(
                "id",
                user.id
            )
            .maybeSingle();


    if (
        profileReadError
    ) {
        console.warn(
            "Could not read profile during OAuth:",
            profileReadError
        );
    }


    /*
     * =====================================================
     * CREATE PROFILE IF MISSING
     * =====================================================
     */

    if (
        !existingProfile
    ) {
        const {
            error:
                insertProfileError,
        } =
            await supabase
                .from(
                    "profiles"
                )
                .insert({
                    id:
                    user.id,

                    first_name:
                    defaultDisplayName,

                    last_name:
                        "",
                });


        /*
         * 23505 = duplicate key.
         *
         * Ignore because a DB trigger may already
         * have created the profile.
         */

        if (
            insertProfileError &&
            insertProfileError.code !==
            "23505"
        ) {
            console.warn(
                "Could not create default profile:",
                insertProfileError
            );
        }
    } else {
        /*
         * =================================================
         * EXISTING PROFILE WITH NO NAME
         * =================================================
         */

        const firstName =
            existingProfile
                .first_name
                ?.trim() ??
            "";

        const lastName =
            existingProfile
                .last_name
                ?.trim() ??
            "";


        /*
         * Don't overwrite anything the user
         * manually entered.
         */

        if (
            !firstName &&
            !lastName
        ) {
            const {
                error:
                    updateProfileError,
            } =
                await supabase
                    .from(
                        "profiles"
                    )
                    .update({
                        first_name:
                        defaultDisplayName,
                    })
                    .eq(
                        "id",
                        user.id
                    );


            if (
                updateProfileError
            ) {
                console.warn(
                    "Could not add default display name:",
                    updateProfileError
                );
            }
        }
    }


    /*
     * =====================================================
     * SHOULD WE RESTORE A GUEST MEME?
     * =====================================================
     *
     * Two independent signals:
     *
     * 1. callback URL:
     *
     *    ?resume=meme
     *
     * 2. browser cookie:
     *
     *    meme_lab_resume=1
     */

    const resumeFromQuery =
        requestUrl.searchParams.get(
            "resume"
        ) === "meme";


    const resumeFromCookie =
        request.cookies.get(
            RESUME_MEME_COOKIE
        )?.value === "1";


    const shouldResumeMeme =
        resumeFromQuery ||
        resumeFromCookie;


    /*
     * =====================================================
     * GUEST MEME FLOW
     * =====================================================
     */

    if (
        shouldResumeMeme
    ) {
        return createRedirect(
            `${appOrigin}/dashboard?resume=meme`,

            authCookies
        );
    }


    /*
     * =====================================================
     * NORMAL LOGIN / SIGNUP
     * =====================================================
     *
     * No forced profile page.
     */

    return createRedirect(
        `${appOrigin}/dashboard?auth=1`,

        authCookies
    );
}