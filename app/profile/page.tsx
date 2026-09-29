import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .single();

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
            <ProfileForm
                userId={user.id}
                email={user.email ?? ""}
                initialFirstName={profile?.first_name ?? ""}
                initialLastName={profile?.last_name ?? ""}
                initialAvatarUrl={profile?.avatar_url ?? null}
            />
        </main>
    );
}