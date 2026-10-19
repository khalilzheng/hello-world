import {
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
 * NO-CACHE REDIRECT
 * =========================================================
 */

function redirectNoStore(
    destination: URL
) {
    const response =
        NextResponse.redirect(
            destination
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
 * DEFAULT DISPLAY NAME
 * =========================================================
 *
 * Example:
 *
 * jialangzheng@gmail.com
 *
 * becomes:
 *
 * jialangzheng
 *
 * We deliberately do NOT force the Google
 * full name.
 *
 * Users can edit their Profile later if
 * they want to.
 */

function getDefaultDisplayName(
    email:
        | string
        | null
        | undefined
) {
    if (
        !email
    ) {
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
 * RESUME COOKIE
 * =========================================================
 *
 * This is the backup signal created when
 * a guest saves a meme before signup.
 */

function hasResumeMemeCookie(
    request: Request
) {
    const cookieHeader =
        request.headers.get(
            "cookie"
        ) ?? "";


    const cookieParts =
        cookieHeader
            .split(";")
            .map(
                (
                    cookie
                ) =>
                    cookie.trim()
            );


    return cookieParts.some(
        (
            cookie
        ) =>
            cookie ===
            `${RESUME_MEME_COOKIE}=1`
    );
}


/*
 * =========================================================
 * GOOGLE OAUTH CALLBACK
 * =========================================================
 */

export async function GET(
    request: Request
) {
    const requestUrl =
        new URL(
            request.url
        );


    const code =
        requestUrl.searchParams.get(
            "code"
        );


    /*
     * =====================================================
     * MISSING CODE
     * =====================================================
     */

    if (
        !code
    ) {
        return redirectNoStore(
            new URL(
                "/login?error=missing_code",
                requestUrl.origin
            )
        );
    }


    const supabase =
        await createClient();


    /*
     * =====================================================
     * EXCHANGE GOOGLE CODE FOR SUPABASE SESSION
     * =====================================================
     *
     * This is the important step that creates
     * the authenticated Supabase session and
     * writes auth cookies.
     */

    const {
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
            new URL(
                "/login?error=oauth",
                requestUrl.origin
            )
        );
    }


    /*
     * =====================================================
     * VERIFY USER AFTER SESSION EXCHANGE
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
            "Session exists but user could not be verified:",
            userError
        );


        return redirectNoStore(
            new URL(
                "/login?error=session",
                requestUrl.origin
            )
        );
    }


    /*
     * =====================================================
     * DEFAULT USER NAME
     * =====================================================
     */

    const defaultDisplayName =
        getDefaultDisplayName(
            user.email
        );


    /*
     * =====================================================
     * CHECK EXISTING PROFILE
     * =====================================================
     *
     * We only fill a default name when needed.
     *
     * If the user previously customized their
     * profile, we leave it untouched.
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
         * This can happen if you already have
         * a database trigger creating profiles.
         *
         * In that case the login itself should
         * still continue normally.
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
    }


    /*
     * =====================================================
     * PROFILE EXISTS BUT NAME IS EMPTY
     * =====================================================
     *
     * Example:
     *
     * first_name = ""
     * last_name  = ""
     *
     * becomes:
     *
     * first_name = email-name
     *
     * But:
     *
     * John / ""
     *
     * stays John.
     *
     * "" / Smith
     *
     * stays Smith.
     */

    else {
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
     * DETERMINE WHETHER THIS USER CAME FROM
     * THE GUEST MEME SIGNUP FLOW
     * =====================================================
     *
     * We support TWO signals:
     *
     * 1. /auth/callback?resume=meme
     *
     * 2. meme_lab_resume=1 cookie
     *
     * Either one is enough.
     */

    const shouldResumeMeme =
        requestUrl.searchParams.get(
            "resume"
        ) ===
        "meme" ||
        hasResumeMemeCookie(
            request
        );


    /*
     * =====================================================
     * GUEST MEME SIGNUP
     * =====================================================
     *
     * Guest:
     *
     * Try Meme Lab
     *      ↓
     * generate meme
     *      ↓
     * Save this meme — sign up free
     *      ↓
     * Google
     *      ↓
     * callback
     *      ↓
     * dashboard?resume=meme
     *
     * Dashboard then reads the actual meme
     * from localStorage and reopens it.
     */

    if (
        shouldResumeMeme
    ) {
        return redirectNoStore(
            new URL(
                "/dashboard?resume=meme",
                requestUrl.origin
            )
        );
    }


    /*
     * =====================================================
     * NORMAL LOGIN / SIGNUP
     * =====================================================
     *
     * No forced Profile onboarding.
     *
     * User immediately enters Meme Lab.
     */

    return redirectNoStore(
        new URL(
            "/dashboard?auth=1",
            requestUrl.origin
        )
    );
}