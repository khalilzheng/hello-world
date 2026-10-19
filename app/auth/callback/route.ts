import {
    NextRequest,
    NextResponse,
} from "next/server";

import {
    createClient,
} from "@/utils/supabase/server";

import {
    RESUME_MEME_COOKIE,
} from "@/app/lib/pendingMeme";


export const dynamic =
    "force-dynamic";

export const revalidate =
    0;


/*
 * =========================================================
 * DISPLAY NAME
 * =========================================================
 *
 * example@gmail.com
 *
 * ->
 *
 * example
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
 * PUBLIC APP ORIGIN
 * =========================================================
 */

function getAppOrigin(
    request:
    NextRequest
) {
    const requestUrl =
        new URL(
            request.url
        );


    /*
     * Local development.
     */
    if (
        process.env.NODE_ENV ===
        "development"
    ) {
        return requestUrl.origin;
    }


    /*
     * Vercel / reverse proxy.
     */
    const forwardedHost =
        request.headers.get(
            "x-forwarded-host"
        );


    const forwardedProto =
        request.headers.get(
            "x-forwarded-proto"
        ) ??
        "https";


    if (
        forwardedHost
    ) {
        return (
            `${forwardedProto}://${forwardedHost}`
        );
    }


    return requestUrl.origin;
}


/*
 * =========================================================
 * REDIRECT
 * =========================================================
 */

function redirectNoStore(
    destination:
    string
) {
    const response =
        NextResponse.redirect(
            destination
        );


    response.headers.set(
        "Cache-Control",
        "private, no-store, no-cache, must-revalidate, max-age=0"
    );


    response.headers.set(
        "Pragma",
        "no-cache"
    );


    return response;
}


/*
 * =========================================================
 * OAUTH CALLBACK
 * =========================================================
 */

export async function GET(
    request:
    NextRequest
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
     * MISSING AUTH CODE
     * =====================================================
     */

    if (
        !code
    ) {
        return redirectNoStore(
            `${appOrigin}/login?error=missing_code`
        );
    }


    const supabase =
        await createClient();


    /*
     * =====================================================
     * EXCHANGE PKCE CODE
     * =====================================================
     *
     * This creates the real authenticated
     * Supabase session.
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
        exchangeError
    ) {
        console.error(
            "OAuth exchange failed:",
            exchangeError
        );


        return redirectNoStore(
            `${appOrigin}/login?error=oauth`
        );
    }


    /*
     * exchangeCodeForSession already returns
     * the authenticated user.
     *
     * Do NOT immediately perform another
     * auth.getUser() just to rediscover the
     * same user.
     */

    const user =
        exchangeData.user ??
        exchangeData.session
            ?.user ??
        null;


    if (
        !user
    ) {
        console.error(
            "OAuth exchange succeeded but no user was returned."
        );


        return redirectNoStore(
            `${appOrigin}/login?error=session`
        );
    }


    /*
     * =====================================================
     * DEFAULT PROFILE NAME
     * =====================================================
     */

    const defaultDisplayName =
        getDefaultDisplayName(
            user.email
        );


    /*
     * =====================================================
     * CHECK PROFILE
     * =====================================================
     */

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
     * CREATE PROFILE
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
         * 23505 means another trigger/process
         * already created it.
         *
         * Login should continue.
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
         * PROFILE EXISTS BUT NAME IS EMPTY
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
         * Never overwrite a name the user
         * already customized.
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
                    "Could not add default profile name:",
                    updateProfileError
                );
            }
        }
    }


    /*
     * =====================================================
     * GUEST MEME RESUME
     * =====================================================
     *
     * The meme itself is stored in localStorage.
     *
     * This cookie simply tells the callback:
     *
     * "after authentication, reopen it."
     *
     * OAuth itself no longer needs a special
     * callback URL.
     */

    const shouldResumeMeme =
        request.cookies.get(
            RESUME_MEME_COOKIE
        )?.value ===
        "1";


    /*
     * =====================================================
     * GUEST MEME SIGNUP
     * =====================================================
     */

    if (
        shouldResumeMeme
    ) {
        return redirectNoStore(
            `${appOrigin}/dashboard?resume=meme`
        );
    }


    /*
     * =====================================================
     * NORMAL LOGIN / SIGNUP
     * =====================================================
     */

    return redirectNoStore(
        `${appOrigin}/dashboard?auth=1`
    );
}