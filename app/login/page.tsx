"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/utils/supabase/client";

import styles from "../AuthPage.module.css";

export default function LoginPage() {
    const supabase =
        createClient();

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        errorMessage,
        setErrorMessage,
    ] = useState("");

    async function login() {
        try {
            setLoading(true);

            setErrorMessage("");

            /*
             * Important:
             *
             * This cookie tells our callback that
             * this is a NORMAL LOGIN.
             *
             * Normal login always goes to /dashboard.
             */
            document.cookie =
                "auth_intent=login; Path=/; Max-Age=600; SameSite=Lax";

            const {
                error,
            } =
                await supabase.auth.signInWithOAuth(
                    {
                        provider:
                            "google",

                        options: {
                            redirectTo:
                                `${window.location.origin}/auth/callback`,
                        },
                    }
                );

            if (error) {
                throw error;
            }
        } catch (error) {
            console.warn(
                error
            );

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not log in."
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
            <header
                className={
                    styles.nav
                }
            >
                <Link
                    href="/dashboard"
                    className={
                        styles.brand
                    }
                >
          <span>
            M
          </span>

                    Meme Lab
                </Link>

                <Link
                    href="/signup"
                    className={
                        styles.navButton
                    }
                >
                    Sign up for free
                </Link>
            </header>

            <section
                className={
                    styles.content
                }
            >
                <div
                    className={
                        styles.card
                    }
                >
                    <div
                        className={
                            styles.mark
                        }
                    >
                        M
                    </div>

                    <p
                        className={
                            styles.eyebrow
                        }
                    >
                        WELCOME BACK
                    </p>

                    <h1>
                        Log in to
                        <br />
                        Meme Lab.
                    </h1>

                    <p
                        className={
                            styles.description
                        }
                    >
                        Create AI memes,
                        vote on campus humor,
                        and discover what
                        Columbia finds funny.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            void login()
                        }
                        disabled={
                            loading
                        }
                    >
                        {loading
                            ? "Connecting..."
                            : "Continue with Google"}
                    </button>

                    {errorMessage && (
                        <p
                            className={
                                styles.error
                            }
                        >
                            {
                                errorMessage
                            }
                        </p>
                    )}

                    <span
                        className={
                            styles.switchText
                        }
                    >
            New to Meme Lab?{" "}
                        <Link href="/signup">
              Sign up for free
            </Link>
          </span>
                </div>
            </section>
        </main>
    );
}