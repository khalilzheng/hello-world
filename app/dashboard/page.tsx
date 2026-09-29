import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
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
                color: "white",
                padding: "24px",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "520px",
                    padding: "40px",
                    borderRadius: "24px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
                }}
            >
                <p
                    style={{
                        color: "#888",
                        fontSize: "13px",
                        marginBottom: "10px",
                    }}
                >
                    PRIVATE AREA
                </p>

                <h1
                    style={{
                        fontSize: "32px",
                        margin: 0,
                    }}
                >
                    Dashboard
                </h1>

                <p
                    style={{
                        marginTop: "14px",
                        color: "#9ca3af",
                        lineHeight: "1.6",
                    }}
                >
                    This page is only available to signed-in users.
                </p>

                <div
                    style={{
                        marginTop: "24px",
                        padding: "16px",
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.05)",
                    }}
                >
                    Signed in as: {user.email}
                </div>

                <a
                    href="/profile"
                    style={{
                        display: "block",
                        marginTop: "20px",
                        padding: "14px",
                        borderRadius: "12px",
                        background: "white",
                        color: "black",
                        textAlign: "center",
                        textDecoration: "none",
                        fontWeight: "600",
                    }}
                >
                    View profile
                </a>
            </div>
        </main>
    );
}