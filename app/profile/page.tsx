import {
    redirect,
} from "next/navigation";

import {
    createClient,
} from "@/utils/supabase/server";

import ProfilePageClient from "./ProfilePageClient";


type ProfilePageProps = {
    searchParams: Promise<{
        welcome?:
            string;
    }>;
};


/*
 * =========================================================
 * EMAIL FALLBACK NAME
 * =========================================================
 *
 * Example:
 *
 * jialangzheng@gmail.com
 *
 * becomes:
 *
 * jialangzheng
 */

function getEmailDisplayName(
    email:
        | string
        | undefined
        | null
) {
    if (
        !email
    ) {
        return "";
    }

    return (
        email
            .split("@")[0]
            ?.trim() ??
        ""
    );
}


export default async function ProfilePage({
                                              searchParams,
                                          }: ProfilePageProps) {
    const supabase =
        await createClient();


    /*
     * ==========================================
     * AUTH
     * ==========================================
     */

    const {
        data: {
            user,
        },

        error:
            userError,
    } =
        await supabase.auth.getUser();


    if (
        userError ||
        !user
    ) {
        redirect(
            "/login"
        );
    }


    /*
     * ==========================================
     * QUERY PARAMS
     * ==========================================
     *
     * We keep this for compatibility with the
     * existing ProfilePageClient.
     *
     * New signup users will no longer normally
     * arrive with ?welcome=1.
     */

    const resolvedSearchParams =
        await searchParams;

    const isWelcome =
        resolvedSearchParams
            .welcome ===
        "1";


    /*
     * ==========================================
     * PROFILE
     * ==========================================
     */

    const {
        data:
            profile,

        error:
            profileError,
    } =
        await supabase
            .from(
                "profiles"
            )
            .select(
                "id, first_name, last_name, avatar_url"
            )
            .eq(
                "id",
                user.id
            )
            .maybeSingle();


    if (
        profileError
    ) {
        console.error(
            "Could not load profile:",
            profileError
        );
    }


    /*
     * ==========================================
     * DEFAULT DISPLAY NAME
     * ==========================================
     *
     * We DO NOT require Profile editing.
     *
     * If first/last name are both empty,
     * use the email name automatically.
     */

    const savedFirstName =
        profile
            ?.first_name
            ?.trim() ??
        "";

    const savedLastName =
        profile
            ?.last_name
            ?.trim() ??
        "";

    const fallbackName =
        getEmailDisplayName(
            user.email
        );


    const initialFirstName =
        savedFirstName ||
        (
            !savedLastName
                ? fallbackName
                : ""
        );


    /*
     * ==========================================
     * USER POSTS
     * ==========================================
     */

    const {
        data:
            generations,

        error:
            generationsError,
    } =
        await supabase
            .from(
                "generations"
            )
            .select(`
                id,
                created_at,
                user_id,
                image_url,
                prompt,
                caption
            `)
            .eq(
                "user_id",
                user.id
            )
            .order(
                "created_at",
                {
                    ascending:
                        false,
                }
            );


    if (
        generationsError
    ) {
        console.error(
            "Could not load user posts:",
            generationsError
        );
    }


    const posts =
        generations ??
        [];


    /*
     * ==========================================
     * VOTES FOR THIS USER'S POSTS
     * ==========================================
     */

    const generationIds =
        posts.map(
            (
                post
            ) =>
                post.id
        );


    let votes:
        {
            generation_id:
                string;

            vote:
                number;
        }[] =
        [];


    if (
        generationIds.length >
        0
    ) {
        const {
            data:
                voteRows,

            error:
                votesError,
        } =
            await supabase
                .from(
                    "votes"
                )
                .select(
                    "generation_id, vote"
                )
                .in(
                    "generation_id",
                    generationIds
                );


        if (
            votesError
        ) {
            console.error(
                "Could not load profile votes:",
                votesError
            );
        } else {
            votes =
                voteRows ??
                [];
        }
    }


    /*
     * ==========================================
     * ADD VOTE STATS
     * ==========================================
     */

    const postsWithVotes =
        posts.map(
            (
                post
            ) => {
                const postVotes =
                    votes.filter(
                        (
                            vote
                        ) =>
                            vote.generation_id ===
                            post.id
                    );


                const funnyCount =
                    postVotes.filter(
                        (
                            vote
                        ) =>
                            vote.vote ===
                            1
                    ).length;


                const notFunnyCount =
                    postVotes.filter(
                        (
                            vote
                        ) =>
                            vote.vote ===
                            -1
                    ).length;


                return {
                    ...post,

                    funnyCount,

                    notFunnyCount,

                    score:
                        funnyCount -
                        notFunnyCount,
                };
            }
        );


    /*
     * ==========================================
     * TOTAL FUNNY VOTES
     * ==========================================
     */

    const totalFunnyVotes =
        postsWithVotes.reduce(
            (
                total,
                post
            ) =>
                total +
                post.funnyCount,

            0
        );


    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (
        <ProfilePageClient
            userId={
                user.id
            }
            email={
                user.email ??
                ""
            }
            initialProfile={{
                firstName:
                initialFirstName,

                lastName:
                savedLastName,

                avatarUrl:
                    profile
                        ?.avatar_url ??
                    "",
            }}
            initialPosts={
                postsWithVotes
            }
            initialFunnyVotes={
                totalFunnyVotes
            }
            welcome={
                isWelcome
            }
        />
    );
}