import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
    request: Request
) {
    const requestUrl =
        new URL(request.url);

    const code =
        requestUrl.searchParams.get(
            "code"
        );

    const origin =
        requestUrl.origin;

    /*
     * OAuth callback must contain
     * an authorization code.
     */
    if (!code) {
        return NextResponse.redirect(
            new URL(
                "/login?error=missing_code",
                origin
            )
        );
    }

    const supabase =
        await createClient();

    /*
     * Exchange OAuth authorization
     * code for a Supabase session.
     */
    const {
        error: exchangeError,
    } =
        await supabase.auth.exchangeCodeForSession(
            code
        );

    if (exchangeError) {
        console.error(
            "OAuth exchange error:",
            exchangeError
        );

        return NextResponse.redirect(
            new URL(
                "/login?error=oauth",
                origin
            )
        );
    }

    /*
     * Get authenticated user.
     */
    const {
        data: { user },
        error: userError,
    } =
        await supabase.auth.getUser();

    if (
        userError ||
        !user
    ) {
        console.error(
            "Authenticated user error:",
            userError
        );

        return NextResponse.redirect(
            new URL(
                "/login?error=session",
                origin
            )
        );
    }

    /*
     * Check Meme Lab profile.
     *
     * Your database trigger automatically
     * creates a profiles row for every
     * new Supabase user.
     */
    const {
        data: profile,
        error: profileError,
    } =
        await supabase
            .from("profiles")
            .select(
                "id, first_name, last_name"
            )
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    if (profileError) {
        console.error(
            "Profile lookup error:",
            profileError
        );

        /*
         * Safer fallback:
         * don't accidentally treat the
         * user as fully onboarded.
         */
        return NextResponse.redirect(
            new URL(
                "/profile?welcome=1",
                origin
            )
        );
    }

    const firstName =
        profile?.first_name?.trim() ?? "";

    const lastName =
        profile?.last_name?.trim() ?? "";

    /*
     * Brand-new account OR
     * account that never finished
     * profile onboarding.
     */
    const profileIncomplete =
        !profile ||
        !firstName ||
        !lastName;

    if (profileIncomplete) {
        return NextResponse.redirect(
            new URL(
                "/profile?welcome=1",
                origin
            )
        );
    }

    /*
     * Returning user with a
     * completed profile.
     */
    return NextResponse.redirect(
        new URL(
            "/dashboard",
            origin
        )
    );
}