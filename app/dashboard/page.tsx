import { createClient } from "@/utils/supabase/server";
import MemeDashboard from "./MemeDashboard";

export default async function DashboardPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <MemeDashboard
            userId={user?.id ?? null}
        />
    );
}