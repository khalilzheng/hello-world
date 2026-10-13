"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "../AuthPage.module.css";

export default function LoginPage() {
    const supabase = useMemo(
        () => createClient(),
        []
    );

    const [loading, setLoading] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    async function loginWithGoogle() {
        try {
            setLoading(true);
            setErrorMessage("");

            const redirectTo =
                `${window.location.origin}/auth/callback`;

            const { error } =
                await supabase.auth.signInWithOAuth({
                    provider: "google",

                    options: {
                        redirectTo,

                        /*
                         * Always let the user choose
                         * which Google account to use.
                         */
                        queryParams: {
                            prompt: "select_account",
                        },
                    },
                });

            if (error) {
                throw error;
            }
        } catch (error) {
            console.warn(error);

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not log in with Google."
            );

            setLoading(false);
        }
    }

    return (
        <main className={styles.page}>
            <div
                className={styles.backgroundGlow}
            />

            <Link
                href="/dashboard"
                className={styles.brand}
            >
        <span
            className={styles.brandMark}
        >
          M
        </span>

                <span>Meme Lab</span>
            </Link>

            <section
                className={styles.authCard}
            >
                <p className={styles.eyebrow}>
                    WELCOME BACK
                </p>

                <h1>Log in to Meme Lab.</h1>

                <p
                    className={styles.description}
                >
                    Continue creating AI memes,
                    voting on campus humor, and
                    exploring the community.
                </p>

                <button
                    type="button"
                    className={styles.googleButton}
                    disabled={loading}
                    onClick={() =>
                        void loginWithGoogle()
                    }
                >
          <span
              className={styles.googleIcon}
          >
            G
          </span>

                    <span>
            {loading
                ? "Connecting..."
                : "Continue with Google"}
          </span>
                </button>

                {errorMessage && (
                    <p className={styles.error}>
                        {errorMessage}
                    </p>
                )}

                <div
                    className={styles.divider}
                >
                    <span />
                    <p>New to Meme Lab?</p>
                    <span />
                </div>

                <Link
                    href="/signup"
                    className={
                        styles.secondaryButton
                    }
                >
                    Sign up for free
                </Link>

                <p
                    className={styles.footerText}
                >
                    Your memes and votes stay
                    connected to your account.
                </p>
            </section>
        </main>
    );
}