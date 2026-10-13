import {
    NextRequest,
    NextResponse,
} from "next/server";

import { createClient } from "@/utils/supabase/server";

export async function GET(
    request: NextRequest
) {
    const requestUrl =
        new URL(
            request.url
        );

    const code =
        requestUrl.searchParams.get(
            "code"
        );

    const origin =
        requestUrl.origin;

    const authIntent =
        request.cookies.get(
            "auth_intent"
        )?.value;

    if (!code) {
        const response =
            NextResponse.redirect(
                new URL(
                    "/login?error=missing_code",
                    origin
                )
            );

        response.cookies.set(
            "auth_intent",
            "",
            {
                path: "/",
                maxAge: 0,
            }
        );

        return response;
    }

    const supabase =
        await createClient();

    const {
        error,
    } =
        await supabase.auth.exchangeCodeForSession(
            code
        );

    if (error) {
        console.error(
            "OAuth callback error:",
            error
        );

        const response =
            NextResponse.redirect(
                new URL(
                    "/login?error=oauth",
                    origin
                )
            );

        response.cookies.set(
            "auth_intent",
            "",
            {
                path: "/",
                maxAge: 0,
            }
        );

        return response;
    }

    /*
     * DEFAULT:
     *
     * Every normal login goes straight
     * to the dashboard.
     */
    let destination =
        "/dashboard";

    /*
     * ONLY when the user clicked
     * "Sign up for free" do we check
     * whether this appears to be a
     * brand-new account.
     */
    if (
        authIntent ===
        "signup"
    ) {
        const {
            data: {
                user,
            },
        } =
            await supabase.auth.getUser();

        if (user) {
            const {
                data:
                    profile,
            } = await supabase
                .from("profiles")
                .select(
                    "first_name, last_name"
                )
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();

            /*
             * New users have an empty profile
             * because our Supabase trigger
             * creates the profile row.
             */
            const firstName =
                profile?.first_name
                    ?.trim() ?? "";

            const lastName =
                profile?.last_name
                    ?.trim() ?? "";

            const profileIsEmpty =
                !firstName &&
                !lastName;

            if (
                profileIsEmpty
            ) {
                destination =
                    "/profile?welcome=1";
            }
        }
    }

    const response =
        NextResponse.redirect(
            new URL(
                destination,
                origin
            )
        );

    /*
     * Remove the temporary auth intent.
     */
    response.cookies.set(
        "auth_intent",
        "",
        {
            path: "/",
            maxAge: 0,
        }
    );

    return response;
}