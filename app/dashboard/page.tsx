import { createClient } from "@/utils/supabase/server";

import MemeDashboard from "./MemeDashboard";

export const dynamic =
    "force-dynamic";

export const revalidate = 0;

type DashboardPageProps = {
    searchParams: Promise<{
        view?: string;
        focus?: string;
        auth?: string;
    }>;
};

export default async function DashboardPage({
                                                searchParams,
                                            }: DashboardPageProps) {
    const supabase =
        await createClient();

    /*
     * NEVER cache the auth result here.
     */
    const {
        data: { user },
    } =
        await supabase.auth.getUser();

    const params =
        await searchParams;

    return (
        <MemeDashboard
            userId={
                user?.id ?? null
            }
            initialView={
                params.view ===
                "explore"
                    ? "explore"
                    : "home"
            }
            focusCreate={
                params.focus ===
                "create"
            }
        />
    );
}