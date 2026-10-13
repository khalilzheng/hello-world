import { createClient } from "@/utils/supabase/server";
import MemeDetailClient from "./MemeDetailClient";

type PageProps = {
    params: Promise<{
        id: string;
    }>;

    searchParams: Promise<{
        created?: string;
    }>;
};

export default async function MemeDetailPage({
                                                 params,
                                                 searchParams,
                                             }: PageProps) {
    const { id } = await params;

    const { created } =
        await searchParams;

    const supabase =
        await createClient();

    const {
        data: { user },
    } =
        await supabase.auth.getUser();

    return (
        <MemeDetailClient
            memeId={id}
            userId={user?.id ?? null}
            initiallyCreated={
                created === "1"
            }
        />
    );
}