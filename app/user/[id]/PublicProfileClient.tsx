"use client";

import Link from "next/link";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { createClient } from "@/utils/supabase/client";
import SiteNav from "@/app/components/SiteNav";

import styles from "./PublicProfile.module.css";

type Props = {
    profileUserId: string;
    viewerUserId: string | null;
};

type PublicProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
};

type Generation = {
    id: string;
    user_id: string;
    created_at: string;
    image_url: string;
    prompt: string;
    caption: string;
};

type VoteCountRow = {
    generation_id: string;
    funny: number | string;
    not_funny: number | string;
    score: number | string;
};

type VoteCount = {
    funny: number;
    notFunny: number;
    score: number;
};

function getName(
    profile: PublicProfile
) {
    const first =
        profile.first_name?.trim() ??
        "";

    const last =
        profile.last_name?.trim() ??
        "";

    return (
        `${first} ${last}`.trim() ||
        "Meme Lab user"
    );
}

function getInitials(
    profile: PublicProfile
) {
    return (
        `${
            profile.first_name
                ?.trim()
                .charAt(0) ??
            ""
        }${
            profile.last_name
                ?.trim()
                .charAt(0) ??
            ""
        }`.toUpperCase() ||
        "M"
    );
}

export default function PublicProfileClient({
                                                profileUserId,
                                                viewerUserId,
                                            }: Props) {
    const supabase =
        useMemo(
            () =>
                createClient(),
            []
        );

    const [
        profile,
        setProfile,
    ] =
        useState<PublicProfile | null>(
            null
        );

    const [
        generations,
        setGenerations,
    ] =
        useState<Generation[]>(
            []
        );

    const [
        voteCounts,
        setVoteCounts,
    ] = useState<
        Record<
            string,
            VoteCount
        >
    >({});

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        notFound,
        setNotFound,
    ] =
        useState(false);

    const loadData =
        useCallback(
            async () => {
                try {
                    setLoading(
                        true
                    );

                    const {
                        data:
                            profileData,

                        error:
                            profileError,
                    } =
                        await supabase.rpc(
                            "get_public_profile",
                            {
                                target_user_id:
                                profileUserId,
                            }
                        );

                    if (
                        profileError
                    ) {
                        throw profileError;
                    }

                    const profileRows =
                        (profileData ??
                            []) as PublicProfile[];

                    const foundProfile =
                        profileRows[0] ??
                        null;

                    if (
                        !foundProfile
                    ) {
                        setNotFound(
                            true
                        );

                        return;
                    }

                    setProfile(
                        foundProfile
                    );

                    const {
                        data:
                            postData,

                        error:
                            postError,
                    } =
                        await supabase.rpc(
                            "get_public_user_posts",
                            {
                                target_user_id:
                                profileUserId,
                            }
                        );

                    if (
                        postError
                    ) {
                        throw postError;
                    }

                    setGenerations(
                        (postData ??
                            []) as Generation[]
                    );

                    const {
                        data:
                            votesData,

                        error:
                            votesError,
                    } =
                        await supabase.rpc(
                            "get_public_vote_counts"
                        );

                    if (
                        votesError
                    ) {
                        throw votesError;
                    }

                    const map: Record<
                        string,
                        VoteCount
                    > = {};

                    for (
                        const row of
                        (votesData ??
                            []) as VoteCountRow[]
                        ) {
                        map[
                            row.generation_id
                            ] = {
                            funny:
                                Number(
                                    row.funny
                                ),

                            notFunny:
                                Number(
                                    row.not_funny
                                ),

                            score:
                                Number(
                                    row.score
                                ),
                        };
                    }

                    setVoteCounts(
                        map
                    );
                } catch (
                    error
                    ) {
                    console.warn(
                        error
                    );

                    setNotFound(
                        true
                    );
                } finally {
                    setLoading(
                        false
                    );
                }
            },
            [
                profileUserId,
                supabase,
            ]
        );

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const totalFunny =
        generations.reduce(
            (
                total,
                post
            ) =>
                total +
                (voteCounts[
                        post.id
                        ]?.funny ??
                    0),
            0
        );

    if (loading) {
        return (
            <>
                <SiteNav
                    userId={
                        viewerUserId
                    }
                />

                <main
                    className={
                        styles.loading
                    }
                >
                    Loading profile...
                </main>
            </>
        );
    }

    if (
        !profile ||
        notFound
    ) {
        return (
            <>
                <SiteNav
                    userId={
                        viewerUserId
                    }
                />

                <main
                    className={
                        styles.loading
                    }
                >
                    <div>
                        <h1>
                            Profile not found
                        </h1>

                        <Link href="/dashboard">
                            Return to Meme Lab
                        </Link>
                    </div>
                </main>
            </>
        );
    }

    return (
        <main className={styles.page}>
            <SiteNav
                userId={
                    viewerUserId
                }
            />

            <section
                className={
                    styles.hero
                }
            >
                <div
                    className={
                        styles.heroInner
                    }
                >
                    {profile.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={
                                profile.avatar_url
                            }
                            alt={
                                getName(
                                    profile
                                )
                            }
                            className={
                                styles.avatar
                            }
                        />
                    ) : (
                        <div
                            className={
                                styles.avatarFallback
                            }
                        >
                            {getInitials(
                                profile
                            )}
                        </div>
                    )}

                    <div
                        className={
                            styles.identity
                        }
                    >
                        <p>
                            COMMUNITY PROFILE
                        </p>

                        <h1>
                            {getName(
                                profile
                            )}
                        </h1>

                        <span>
              Creating campus chaos,
              one meme at a time.
            </span>
                    </div>

                    <div
                        className={
                            styles.stats
                        }
                    >
                        <div>
                            <strong>
                                {
                                    generations.length
                                }
                            </strong>

                            <span>
                Posts
              </span>
                        </div>

                        <div>
                            <strong>
                                {
                                    totalFunny
                                }
                            </strong>

                            <span>
                Funny votes
              </span>
                        </div>
                    </div>
                </div>
            </section>

            <section
                className={
                    styles.posts
                }
            >
                <div
                    className={
                        styles.postsHeader
                    }
                >
                    <div>
                        <p>
                            CREATIONS
                        </p>

                        <h2>
                            Posts
                        </h2>
                    </div>

                    <span>
            {
                generations.length
            }{" "}
                        {generations.length ===
                        1
                            ? "post"
                            : "posts"}
          </span>
                </div>

                <div
                    className={
                        styles.grid
                    }
                >
                    {generations.map(
                        (
                            post
                        ) => {
                            const funny =
                                voteCounts[
                                    post.id
                                    ]?.funny ??
                                0;

                            return (
                                <Link
                                    href={`/meme/${post.id}`}
                                    key={
                                        post.id
                                    }
                                    className={
                                        styles.card
                                    }
                                >
                                    <div
                                        className={
                                            styles.imageWrap
                                        }
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={
                                                post.image_url
                                            }
                                            alt={
                                                post.caption
                                            }
                                        />
                                    </div>

                                    <div
                                        className={
                                            styles.cardBody
                                        }
                                    >
                                        <h3>
                                            {
                                                post.caption
                                            }
                                        </h3>

                                        <p>
                                            Prompt:{" "}
                                            {
                                                post.prompt
                                            }
                                        </p>

                                        <div
                                            className={
                                                styles.meta
                                            }
                                        >
                                            <strong>
                                                ↑ Funny{" "}
                                                {funny}
                                            </strong>

                                            <span>
                        {new Date(
                            post.created_at
                        ).toLocaleDateString(
                            undefined,
                            {
                                month:
                                    "short",

                                day:
                                    "numeric",
                            }
                        )}
                      </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        }
                    )}
                </div>
            </section>
        </main>
    );
}