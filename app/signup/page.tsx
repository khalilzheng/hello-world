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


export default function SignupPage() {
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
     * ======================================================
     * ALREADY LOGGED IN
     * ======================================================
     */

    useEffect(() => {
        let mounted =
            true;


        async function checkExistingSession() {
            const {
                data: {
                    user,
                },
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
            mounted =
                false;
        };
    }, [
        router,
        supabase,
    ]);


    /*
     * ======================================================
     * GOOGLE SIGNUP
     * ======================================================
     *
     * IMPORTANT:
     *
     * OAuth ALWAYS goes through exactly:
     *
     * /auth/callback
     *
     * We DO NOT put ?resume=meme into
     * Supabase redirectTo anymore.
     */

    async function signUpWithGoogle() {
        setLoading(
            true
        );


        setError("");


        const redirectTo =
            `${window.location.origin}/auth/callback`;


        const {
            error:
                oauthError,
        } =
            await supabase.auth.signInWithOAuth({
                provider:
                    "google",

                options: {
                    redirectTo,

                    queryParams: {
                        prompt:
                            "select_account",
                    },
                },
            });


        if (
            oauthError
        ) {
            setError(
                oauthError.message
            );

            setLoading(
                false
            );
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
                    JOIN MEME LAB
                </p>


                <h1>
                    Create your account.
                </h1>


                <p
                    className={
                        styles.description
                    }
                >
                    Post your own AI memes,
                    vote, and explore what
                    everyone is making.
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
                        void signUpWithGoogle()
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
                        : "Sign up with Google"}
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
                        ALREADY A MEMBER?
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
                            "/login"
                        )
                    }
                >
                    Log in
                </button>


                <p
                    className={
                        styles.footerText
                    }
                >
                    You can personalize your
                    profile anytime.
                </p>
            </section>
        </main>
    );
}