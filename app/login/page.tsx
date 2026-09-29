"use client";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
    const supabase = createClient();

    async function signInWithGoogle() {
        const origin = window.location.origin;

        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${origin}/auth/callback`,
            },
        });
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
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "24px",
                    padding: "40px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
                    backdropFilter: "blur(16px)",
                }}
            >
                <div
                    style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "14px",
                        background: "white",
                        color: "black",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                        fontWeight: "700",
                        marginBottom: "28px",
                    }}
                >
                    M
                </div>

                <h1
                    style={{
                        fontSize: "32px",
                        margin: 0,
                        fontWeight: "600",
                        letterSpacing: "-0.8px",
                    }}
                >
                    Welcome back
                </h1>

                <p
                    style={{
                        marginTop: "12px",
                        marginBottom: "32px",
                        color: "#9ca3af",
                        lineHeight: "1.6",
                    }}
                >
                    Sign in to access your profile and personalized movie
                    experience.
                </p>

                <button
                    onClick={signInWithGoogle}
                    style={{
                        width: "100%",
                        height: "52px",
                        borderRadius: "14px",
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "white",
                        color: "#111",
                        fontSize: "16px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "12px",
                    }}
                >
                    <span
                        style={{
                            fontSize: "20px",
                            fontWeight: "700",
                        }}
                    >
                        G
                    </span>
                    Continue with Google
                </button>

                <p
                    style={{
                        marginTop: "24px",
                        marginBottom: 0,
                        textAlign: "center",
                        color: "#6b7280",
                        fontSize: "13px",
                    }}
                >
                    Authentication powered by Supabase
                </p>
            </div>
        </main>
    );
}