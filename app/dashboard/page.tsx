import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import MemeDashboard from "./MemeDashboard";

export default async function DashboardPage() {
    const supabase =
        await createClient();

    const {
        data: { user },
    } =
        await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <MemeDashboard
            userId={user.id}
            email={user.email ?? ""}
        />
    );
}