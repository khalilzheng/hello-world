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
                        cookiesToSet,
                        headers
                    ) {
                        /*
                         * Keep the incoming request
                         * synchronized with refreshed
                         * Supabase cookies.
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
                         * Re-create the response using
                         * the updated request.
                         */
                        supabaseResponse =
                            NextResponse.next({
                                request,
                            });


                        /*
                         * Send refreshed auth cookies
                         * back to the browser.
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


                        /*
                         * @supabase/ssr 0.12.x may also
                         * provide important cache headers.
                         *
                         * Preserve them.
                         */
                        Object.entries(
                            headers ?? {}
                        ).forEach(
                            ([
                                 key,
                                 value,
                             ]) => {
                                supabaseResponse.headers.set(
                                    key,
                                    value
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
     * Call getUser immediately after creating
     * the Supabase client.
     *
     * This verifies / refreshes the session.
     *
     * Meme Lab intentionally allows logged-out
     * browsing, so we DO NOT redirect guests here.
     */
    await supabase.auth.getUser();


    /*
     * IMPORTANT:
     *
     * Return THIS exact response because it
     * contains any refreshed Supabase cookies.
     */
    return supabaseResponse;
}


export const config = {
    matcher: [
        /*
         * Run for app routes while skipping
         * static/image assets.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};