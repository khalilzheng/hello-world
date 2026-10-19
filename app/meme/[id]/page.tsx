import { notFound } from "next/navigation";

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

type VoteCountRow = {
    generation_id: string;
    funny: number;
    not_funny: number;
    score: number;
};

type RelatedGeneration = {
    id: string;
    created_at: string;
    user_id: string;
    image_url: string;
    caption: string;
};

export default async function MemePage({
                                           params,
                                           searchParams,
                                       }: PageProps) {
    const { id } = await params;

    const query = await searchParams;

    const supabase =
        await createClient();

    /*
     * ======================================================
     * CURRENT USER
     * ======================================================
     */

    const {
        data: { user },
    } =
        await supabase.auth.getUser();

    /*
     * ======================================================
     * CURRENT MEME
     * ======================================================
     */

    const {
        data: post,
        error: postError,
    } =
        await supabase
            .from("generations")
            .select(`
                id,
                created_at,
                user_id,
                image_url,
                caption
            `)
            .eq("id", id)
            .maybeSingle();

    if (
        postError ||
        !post
    ) {
        notFound();
    }

    /*
     * ======================================================
     * CREATOR PROFILE
     * ======================================================
     */

    let profile = {
        id:
        post.user_id,

        first_name:
            null as string | null,

        last_name:
            null as string | null,

        avatar_url:
            null as string | null,
    };

    const {
        data: publicProfileData,
    } =
        await supabase.rpc(
            "get_public_profile",
            {
                target_user_id:
                post.user_id,
            }
        );

    const rawProfile =
        Array.isArray(
            publicProfileData
        )
            ? publicProfileData[0]
            : publicProfileData;

    if (rawProfile) {
        profile = {
            id:
                rawProfile.id ??
                rawProfile.user_id ??
                post.user_id,

            first_name:
                rawProfile.first_name ??
                null,

            last_name:
                rawProfile.last_name ??
                null,

            avatar_url:
                rawProfile.avatar_url ??
                null,
        };
    }

    /*
     * ======================================================
     * VOTE COUNTS
     * ======================================================
     */

    const {
        data: countRows,
    } =
        await supabase.rpc(
            "get_public_vote_counts"
        );

    const safeCounts =
        (countRows ??
            []) as VoteCountRow[];

    const currentCount =
        safeCounts.find(
            (row) =>
                row.generation_id ===
                post.id
        );

    const funny =
        Number(
            currentCount?.funny
        ) || 0;

    const notFunny =
        Number(
            currentCount?.not_funny
        ) || 0;

    /*
     * ======================================================
     * CURRENT USER'S VOTE
     * ======================================================
     */

    let initialUserVote:
        | 1
        | -1
        | null = null;

    if (user) {
        const {
            data: voteRow,
        } =
            await supabase
                .from("votes")
                .select("vote")
                .eq(
                    "user_id",
                    user.id
                )
                .eq(
                    "generation_id",
                    post.id
                )
                .maybeSingle();

        if (
            voteRow?.vote ===
            1 ||
            voteRow?.vote ===
            -1
        ) {
            initialUserVote =
                voteRow.vote;
        }
    }

    /*
     * ======================================================
     * YOU MIGHT ALSO LIKE
     * ======================================================
     *
     * Pull other recent memes.
     *
     * We intentionally do NOT include the prompt.
     */

    const {
        data: relatedRows,
        error: relatedError,
    } =
        await supabase
            .from("generations")
            .select(`
                id,
                created_at,
                user_id,
                image_url,
                caption
            `)
            .neq("id", post.id)
            .order(
                "created_at",
                {
                    ascending:
                        false,
                }
            )
            .limit(9);

    if (relatedError) {
        console.warn(
            "Could not load related memes:",
            relatedError
        );
    }

    const relatedBase =
        (relatedRows ??
            []) as RelatedGeneration[];

    /*
     * Add public vote totals to
     * recommendation cards.
     */

    const relatedPosts =
        relatedBase.map(
            (
                relatedPost
            ) => {
                const count =
                    safeCounts.find(
                        (
                            row
                        ) =>
                            row.generation_id ===
                            relatedPost.id
                    );

                return {
                    ...relatedPost,

                    funny:
                        Number(
                            count?.funny
                        ) || 0,

                    not_funny:
                        Number(
                            count?.not_funny
                        ) || 0,
                };
            }
        );

    return (
        <MemeDetailClient
            post={post}
            profile={profile}
            currentUserId={
                user?.id ??
                null
            }
            initialFunny={
                funny
            }
            initialNotFunny={
                notFunny
            }
            initialUserVote={
                initialUserVote
            }
            showCreatedIntro={
                query.created ===
                "1"
            }
            relatedPosts={
                relatedPosts
            }
        />
    );
}