import { createClient } from "@/utils/supabase/server";
import PublicProfileClient from "./PublicProfileClient";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function PublicProfilePage({
                                                    params,
                                                }: Props) {
    const { id } =
        await params;

    const supabase =
        await createClient();

    const {
        data: { user },
    } =
        await supabase.auth.getUser();

    return (
        <PublicProfileClient
            profileUserId={id}
            viewerUserId={
                user?.id ??
                null
            }
        />
    );
}