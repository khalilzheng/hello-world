import {
    createServerClient,
} from "@supabase/ssr";

import {
    NextResponse,
    type NextRequest,
} from "next/server";


export async function proxy(
    request: NextRequest
) {
    let supabaseResponse =
        NextResponse.next({
            request,
        });


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
                        /*
                         * Update the cookies on the
                         * incoming request first.
                         */
                        cookiesToSet.forEach(
                            ({
                                 name,
                                 value,
                             }) => {
                                request.cookies.set(
                                    name,
                                    value
                                );
                            }
                        );


                        /*
                         * Create a fresh response that
                         * contains the updated request.
                         */
                        supabaseResponse =
                            NextResponse.next(
                                {
                                    request,
                                }
                            );


                        /*
                         * Send the refreshed Supabase
                         * cookies back to the browser.
                         */
                        cookiesToSet.forEach(
                            ({
                                 name,
                                 value,
                                 options,
                             }) => {
                                supabaseResponse.cookies.set(
                                    name,
                                    value,
                                    options
                                );
                            }
                        );
                    },
                },
            }
        );


    /*
     * IMPORTANT:
     *
     * This verifies / refreshes the current
     * Supabase user session.
     *
     * Do not remove this.
     *
     * We deliberately DO NOT redirect logged-out
     * visitors, because Meme Lab supports:
     *
     * - public Explore
     * - guest browsing
     * - Try Meme Lab instantly
     */
    await supabase.auth.getUser();


    return supabaseResponse;
}


export const config = {
    matcher: [
        /*
         * Run on normal application pages,
         * but skip static assets.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};