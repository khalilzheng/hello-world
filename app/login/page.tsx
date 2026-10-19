"use client";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import {
    createClient,
} from "@/utils/supabase/client";

import styles from "../AuthPage.module.css";


export default function LoginPage() {
    const router =
        useRouter();

    const supabase =
        useMemo(
            () =>
                createClient(),
            []
        );

    const [
        loading,
        setLoading,
    ] =
        useState(false);

    const [
        error,
        setError,
    ] =
        useState("");


    /*
     * If browser already has a valid session,
     * do not leave the user staring at Log in.
     */

    useEffect(() => {
        let mounted = true;

        async function checkExistingSession() {
            const {
                data: { user },
            } =
                await supabase.auth.getUser();

            if (
                mounted &&
                user
            ) {
                router.replace(
                    "/dashboard"
                );

                router.refresh();
            }
        }

        void checkExistingSession();

        return () => {
            mounted = false;
        };
    }, [
        router,
        supabase,
    ]);


    async function signInWithGoogle() {
        setLoading(true);
        setError("");

        const redirectTo =
            `${window.location.origin}/auth/callback`;

        const {
            error:
                oauthError,
        } =
            await supabase.auth.signInWithOAuth(
                {
                    provider:
                        "google",

                    options: {
                        redirectTo,

                        queryParams: {
                            prompt:
                                "select_account",
                        },
                    },
                }
            );

        if (
            oauthError
        ) {
            setError(
                oauthError.message
            );

            setLoading(false);
        }
    }


    return (
        <main
            className={
                styles.page
            }
        >
            <div
                className={
                    styles.backgroundGlow
                }
            />

            <button
                type="button"
                className={
                    styles.brand
                }
                onClick={() =>
                    router.push(
                        "/dashboard"
                    )
                }
            >
        <span
            className={
                styles.brandMark
            }
        >
          M
        </span>

                Meme Lab
            </button>

            <section
                className={
                    styles.authCard
                }
            >
                <p
                    className={
                        styles.eyebrow
                    }
                >
                    WELCOME BACK
                </p>

                <h1>
                    Log in to Meme Lab.
                </h1>

                <p
                    className={
                        styles.description
                    }
                >
                    Create, post, and
                    vote on campus memes.
                </p>

                <button
                    type="button"
                    className={
                        styles.googleButton
                    }
                    disabled={
                        loading
                    }
                    onClick={() =>
                        void signInWithGoogle()
                    }
                >
          <span
              className={
                  styles.googleIcon
              }
          >
            G
          </span>

                    {loading
                        ? "Opening Google..."
                        : "Continue with Google"}
                </button>

                {error && (
                    <p
                        className={
                            styles.error
                        }
                    >
                        {error}
                    </p>
                )}

                <div
                    className={
                        styles.divider
                    }
                >
                    <span />
                    <small>
                        NEW HERE?
                    </small>
                    <span />
                </div>

                <button
                    type="button"
                    className={
                        styles.secondaryButton
                    }
                    onClick={() =>
                        router.push(
                            "/signup"
                        )
                    }
                >
                    Sign up for free
                </button>

                <p
                    className={
                        styles.footerText
                    }
                >
                    You can browse the
                    community without an
                    account.
                </p>
            </section>
        </main>
    );
}