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
 * We intentionally use the part BEFORE @.
 *
 * Example:
 *
 * jialangzheng@gmail.com
 *
 * becomes:
 *
 * jialangzheng
 *
 * We do NOT force Google full name.
 * The user can change their profile later.
 */

function getDefaultDisplayName(
    email:
        | string
        | undefined
        | null
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
 * COOKIE HELPER
 * =========================================================
 */

function hasResumeMemeCookie(
    request: Request
) {
    const cookieHeader =
        request.headers.get(
            "cookie"
        ) ?? "";

    const cookies =
        cookieHeader
            .split(";")
            .map(
                (cookie) =>
                    cookie.trim()
            );

    return cookies.some(
        (cookie) =>
            cookie ===
            `${RESUME_MEME_COOKIE}=1`
    );
}


/*
 * =========================================================
 * OAUTH CALLBACK
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
     * VALIDATE OAUTH CODE
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
     * EXCHANGE CODE FOR SESSION
     * =====================================================
     *
     * This writes the user's authenticated
     * Supabase session cookies.
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
     * DEFAULT PROFILE NAME
     * =====================================================
     *
     * Every authenticated user should have
     * a useful public display name even if
     * they never touch Profile settings.
     */

    const defaultDisplayName =
        getDefaultDisplayName(
            user.email
        );


    /*
     * First see whether the profile already exists.
     *
     * IMPORTANT:
     *
     * We do NOT overwrite names that the user
     * manually entered before.
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
     * PROFILE DOES NOT EXIST
     * =====================================================
     *
     * Create a minimal profile automatically.
     *
     * The user does NOT need to edit it.
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

                    /*
                     * Last name is deliberately optional.
                     *
                     * We don't invent one.
                     */
                    last_name:
                        "",
                });


        /*
         * A profile trigger could theoretically
         * create the row at nearly the same time.
         *
         * Don't destroy the login flow because of
         * a harmless duplicate-profile race.
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
     * PROFILE EXISTS BUT HAS NO NAME
     * =====================================================
     *
     * Example:
     *
     * first_name = ""
     * last_name  = ""
     *
     * Fix only the first name.
     *
     * If the user already entered a real name,
     * leave it completely untouched.
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


        /*
         * Only fill a default if BOTH are blank.
         *
         * This means:
         *
         * John / ""
         *
         * stays John.
         *
         * "" / Smith
         *
         * stays Smith.
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
     * GUEST MEME SIGNUP
     * =====================================================
     *
     * If this account was created from:
     *
     * Try Meme Lab
     *      ↓
     * Save this meme — sign up free
     *
     * take them directly back to the
     * saved preview.
     *
     * DO NOT go to Profile.
     */

    if (
        hasResumeMemeCookie(
            request
        )
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
     * NORMAL SIGNUP / LOGIN
     * =====================================================
     *
     * No onboarding wall.
     * No forced profile editing.
     *
     * User lands directly inside Meme Lab.
     */

    return redirectNoStore(
        new URL(
            "/dashboard?auth=1",
            requestUrl.origin
        )
    );
}