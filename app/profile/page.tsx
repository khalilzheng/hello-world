import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

import SiteNav from "@/app/components/SiteNav";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
    const supabase =
        await createClient();

    const {
        data: { user },
    } =
        await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const {
        data: profile,
    } =
        await supabase
            .from("profiles")
            .select(
                "first_name, last_name, avatar_url"
            )
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    return (
        <>
            <SiteNav
                userId={user.id}
            />

            <ProfileForm
                userId={user.id}
                email={
                    user.email ?? ""
                }
                initialFirstName={
                    profile?.first_name ??
                    ""
                }
                initialLastName={
                    profile?.last_name ??
                    ""
                }
                initialAvatarUrl={
                    profile?.avatar_url ??
                    ""
                }
            />
        </>
    );
}