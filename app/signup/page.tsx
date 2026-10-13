"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/utils/supabase/client";

import styles from "../AuthPage.module.css";

export default function SignupPage() {
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

    async function signup() {
        try {
            setLoading(true);

            setErrorMessage("");

            /*
             * The callback checks this cookie.
             *
             * signup + empty profile
             *       ↓
             * /profile
             *
             * existing account
             *       ↓
             * /dashboard
             */
            document.cookie =
                "auth_intent=signup; Path=/; Max-Age=600; SameSite=Lax";

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
                    : "Could not sign up."
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
                    href="/login"
                    className={
                        styles.navButton
                    }
                >
                    Log in
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
                        JOIN MEME LAB
                    </p>

                    <h1>
                        Campus life
                        <br />
                        deserves better memes.
                    </h1>

                    <p
                        className={
                            styles.description
                        }
                    >
                        Create AI-generated
                        memes, share them with
                        the community, and vote
                        on the ones actually
                        worth laughing at.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            void signup()
                        }
                        disabled={
                            loading
                        }
                    >
                        {loading
                            ? "Connecting..."
                            : "Sign up with Google"}
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
            Already have an account?{" "}
                        <Link href="/login">
              Log in
            </Link>
          </span>
                </div>
            </section>
        </main>
    );
}