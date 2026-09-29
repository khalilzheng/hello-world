"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
    const router = useRouter();

    const [supabase] = useState(() =>
        createClient()
    );

    const [loading, setLoading] =
        useState(true);

    const [signingIn, setSigningIn] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    useEffect(() => {
        async function checkUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                router.replace("/profile");
                return;
            }

            setLoading(false);
        }

        checkUser();
    }, [router, supabase]);

    async function signInWithGoogle() {
        setSigningIn(true);
        setErrorMessage("");

        const origin = window.location.origin;

        const { error } =
            await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${origin}/auth/callback`,
                },
            });

        if (error) {
            setSigningIn(false);
            setErrorMessage(error.message);
        }
    }

    if (loading) {
        return (
            <main
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                        "radial-gradient(circle at top, #1b1b1b 0%, #0a0a0a 45%, #050505 100%)",
                    color: "white",
                }}
            >
                <p
                    style={{
                        color: "#9ca3af",
                        fontSize: "14px",
                    }}
                >
                    Checking session...
                </p>
            </main>
        );
    }

    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "radial-gradient(circle at top, #1b1b1b 0%, #0a0a0a 45%, #050505 100%)",
                padding: "24px",
                color: "white",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "430px",
                    padding: "46px",
                    borderRadius: "24px",
                    background:
                        "rgba(255,255,255,0.055)",
                    border:
                        "1px solid rgba(255,255,255,0.12)",
                    boxShadow:
                        "0 24px 70px rgba(0,0,0,0.5)",
                    backdropFilter: "blur(16px)",
                }}
            >
                <div
                    style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "16px",
                        background: "white",
                        color: "#111",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "25px",
                        fontWeight: "700",
                        marginBottom: "36px",
                    }}
                >
                    M
                </div>

                <h1
                    style={{
                        margin: 0,
                        fontSize: "36px",
                        fontWeight: "600",
                        letterSpacing: "-1px",
                    }}
                >
                    Welcome back
                </h1>

                <p
                    style={{
                        marginTop: "18px",
                        marginBottom: "38px",
                        color: "#9ca3af",
                        fontSize: "17px",
                        lineHeight: "1.6",
                    }}
                >
                    Sign in to access your profile and
                    personalized movie experience.
                </p>

                <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={signingIn}
                    style={{
                        width: "100%",
                        height: "60px",
                        border: "none",
                        borderRadius: "15px",
                        background: "white",
                        color: "#111",
                        fontSize: "18px",
                        fontWeight: "600",
                        cursor: signingIn
                            ? "not-allowed"
                            : "pointer",
                        opacity: signingIn
                            ? 0.7
                            : 1,
                    }}
                >
                    {signingIn
                        ? "Redirecting..."
                        : "G   Continue with Google"}
                </button>

                {errorMessage && (
                    <p
                        style={{
                            marginTop: "18px",
                            textAlign: "center",
                            color: "#f87171",
                            fontSize: "14px",
                        }}
                    >
                        {errorMessage}
                    </p>
                )}

                <p
                    style={{
                        marginTop: "30px",
                        marginBottom: 0,
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "14px",
                    }}
                >
                    Authentication powered by Supabase
                </p>
            </div>
        </main>
    );
}