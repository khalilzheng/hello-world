import PublicProfileClient from "./PublicProfileClient";

type UserPageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function UserPage({
                                           params,
                                       }: UserPageProps) {
    const { id } =
        await params;

    return (
        <PublicProfileClient
            profileUserId={
                id
            }
        />
    );
}