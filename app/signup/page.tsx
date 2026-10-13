"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "../AuthPage.module.css";

export default function SignupPage() {
    const supabase = useMemo(
        () => createClient(),
        []
    );

    const [loading, setLoading] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    async function signUpWithGoogle() {
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
                         * IMPORTANT:
                         * Even if Google is already signed in,
                         * show the account chooser instead of
                         * silently reusing the previous account.
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
                    : "Could not continue with Google."
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
                    JOIN MEME LAB
                </p>

                <h1>Create your account.</h1>

                <p
                    className={styles.description}
                >
                    Create AI-powered campus memes,
                    vote on community creations, and
                    build your Meme Lab profile.
                </p>

                <button
                    type="button"
                    className={styles.googleButton}
                    disabled={loading}
                    onClick={() =>
                        void signUpWithGoogle()
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
                : "Sign up with Google"}
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
                    <p>Already have an account?</p>
                    <span />
                </div>

                <Link
                    href="/login"
                    className={
                        styles.secondaryButton
                    }
                >
                    Log in
                </Link>

                <p
                    className={styles.footerText}
                >
                    Your profile is created after
                    signing in with Google.
                </p>
            </section>
        </main>
    );
}