"use client";

import Link from "next/link";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from "react";
import { useRouter } from "next/navigation";

import SiteNav from "@/app/components/SiteNav";
import { createClient } from "@/utils/supabase/client";

import styles from "./PublicProfile.module.css";

type PublicProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
};

type Generation = {
    id: string;
    created_at: string;
    user_id: string;
    image_url: string;
    prompt: string;
    caption: string;
};

type VoteCount = {
    generation_id: string;
    funny: number;
    not_funny: number;
    score: number;
};

type PublicProfileClientProps = {
    profileUserId: string;
};

export default function PublicProfileClient({
                                                profileUserId,
                                            }: PublicProfileClientProps) {
    const router =
        useRouter();

    const supabase =
        useMemo(
            () =>
                createClient(),
            []
        );

    const [
        currentUserId,
        setCurrentUserId,
    ] =
        useState<
            string | null
        >(null);

    const [
        profile,
        setProfile,
    ] =
        useState<
            PublicProfile | null
        >(null);

    const [
        posts,
        setPosts,
    ] =
        useState<
            Generation[]
        >([]);

    const [
        voteCounts,
        setVoteCounts,
    ] =
        useState<
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
        errorMessage,
        setErrorMessage,
    ] =
        useState("");

    /*
     * ======================================================
     * CRITICAL SCROLL FIX
     *
     * When entering /user/[id], always start at the top.
     * This fixes the page opening halfway down at Posts.
     * ======================================================
     */

    useLayoutEffect(() => {
        if (
            "scrollRestoration" in
            window.history
        ) {
            window.history.scrollRestoration =
                "manual";
        }

        window.scrollTo(
            0,
            0
        );

        document.documentElement.scrollTop =
            0;

        document.body.scrollTop =
            0;

        requestAnimationFrame(
            () => {
                window.scrollTo(
                    0,
                    0
                );
            }
        );
    }, [
        profileUserId,
    ]);

    /*
     * Run it again after loading,
     * because image/layout rendering can sometimes
     * make browsers restore the old scroll position.
     */

    useEffect(() => {
        if (loading) {
            return;
        }

        const timer =
            window.setTimeout(
                () => {
                    window.scrollTo({
                        top: 0,
                        left: 0,
                        behavior:
                            "auto",
                    });

                    document.documentElement.scrollTop =
                        0;

                    document.body.scrollTop =
                        0;
                },
                0
            );

        return () =>
            window.clearTimeout(
                timer
            );
    }, [
        loading,
        profileUserId,
    ]);

    /*
     * ======================================================
     * AUTH
     * ======================================================
     */

    useEffect(() => {
        let mounted = true;

        async function loadUser() {
            const {
                data: { user },
            } =
                await supabase.auth.getUser();

            if (!mounted) {
                return;
            }

            setCurrentUserId(
                user?.id ??
                null
            );
        }

        void loadUser();

        const {
            data: {
                subscription,
            },
        } =
            supabase.auth.onAuthStateChange(
                (
                    _event,
                    session
                ) => {
                    if (
                        !mounted
                    ) {
                        return;
                    }

                    setCurrentUserId(
                        session
                            ?.user
                            ?.id ??
                        null
                    );
                }
            );

        return () => {
            mounted = false;

            subscription.unsubscribe();
        };
    }, [supabase]);

    /*
     * ======================================================
     * LOAD PUBLIC PROFILE
     * ======================================================
     */

    const loadProfile =
        useCallback(
            async () => {
                setLoading(
                    true
                );

                setErrorMessage(
                    ""
                );

                try {
                    /*
                     * --------------------------------------
                     * PUBLIC PROFILE
                     * --------------------------------------
                     */

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

                    const rawProfile =
                        Array.isArray(
                            profileData
                        )
                            ? profileData[0]
                            : profileData;

                    if (
                        !rawProfile
                    ) {
                        setProfile(
                            null
                        );

                        setPosts(
                            []
                        );

                        setErrorMessage(
                            "This profile could not be found."
                        );

                        return;
                    }

                    const raw =
                        rawProfile as {
                            id?: string;
                            user_id?: string;
                            first_name?: string | null;
                            last_name?: string | null;
                            avatar_url?: string | null;
                        };

                    const normalizedProfile: PublicProfile =
                        {
                            id:
                                raw.id ??
                                raw.user_id ??
                                profileUserId,

                            first_name:
                                raw.first_name ??
                                null,

                            last_name:
                                raw.last_name ??
                                null,

                            avatar_url:
                                raw.avatar_url ??
                                null,
                        };

                    setProfile(
                        normalizedProfile
                    );

                    /*
                     * --------------------------------------
                     * THIS USER'S POSTS
                     * --------------------------------------
                     */

                    const {
                        data:
                            generationRows,

                        error:
                            generationError,
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
                                profileUserId
                            )
                            .order(
                                "created_at",
                                {
                                    ascending:
                                        false,
                                }
                            );

                    if (
                        generationError
                    ) {
                        throw generationError;
                    }

                    const safePosts =
                        (generationRows ??
                            []) as Generation[];

                    setPosts(
                        safePosts
                    );

                    /*
                     * --------------------------------------
                     * PUBLIC VOTE COUNTS
                     * --------------------------------------
                     */

                    const {
                        data:
                            countRows,

                        error:
                            countError,
                    } =
                        await supabase.rpc(
                            "get_public_vote_counts"
                        );

                    if (
                        countError
                    ) {
                        console.warn(
                            countError
                        );
                    }

                    const nextCounts: Record<
                        string,
                        VoteCount
                    > = {};

                    (
                        (countRows ??
                            []) as VoteCount[]
                    ).forEach(
                        (row) => {
                            nextCounts[
                                row.generation_id
                                ] = {
                                generation_id:
                                row.generation_id,

                                funny:
                                    Number(
                                        row.funny
                                    ) ||
                                    0,

                                not_funny:
                                    Number(
                                        row.not_funny
                                    ) ||
                                    0,

                                score:
                                    Number(
                                        row.score
                                    ) ||
                                    0,
                            };
                        }
                    );

                    setVoteCounts(
                        nextCounts
                    );
                } catch (error) {
                    console.warn(
                        error
                    );

                    setErrorMessage(
                        "Couldn’t load this profile."
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
        void loadProfile();
    }, [
        loadProfile,
    ]);

    /*
     * ======================================================
     * DERIVED PROFILE DATA
     * ======================================================
     */

    const displayName =
        useMemo(() => {
            if (
                !profile
            ) {
                return "";
            }

            const name = [
                profile.first_name,
                profile.last_name,
            ]
                .filter(
                    Boolean
                )
                .join(" ")
                .trim();

            return (
                name ||
                "Campus creator"
            );
        }, [
            profile,
        ]);

    const totalFunnyVotes =
        useMemo(() => {
            return posts.reduce(
                (
                    total,
                    post
                ) => {
                    const count =
                        voteCounts[
                            post.id
                            ];

                    return (
                        total +
                        (count?.funny ??
                            0)
                    );
                },
                0
            );
        }, [
            posts,
            voteCounts,
        ]);

    function formatDate(
        value: string
    ) {
        return new Intl.DateTimeFormat(
            "en-US",
            {
                month:
                    "short",
                day:
                    "numeric",
                timeZone:
                    "UTC",
            }
        ).format(
            new Date(
                value
            )
        );
    }

    /*
     * ======================================================
     * NAV
     * ======================================================
     */

    function goHome() {
        router.push(
            "/dashboard"
        );
    }

    function goCreate() {
        router.push(
            "/dashboard?focus=create"
        );
    }

    function goExplore() {
        router.push(
            "/dashboard?view=explore"
        );
    }

    /*
     * ======================================================
     * LOADING
     * ======================================================
     */

    if (loading) {
        return (
            <main
                className={
                    styles.page
                }
            >
                <SiteNav
                    userId={
                        currentUserId
                    }
                    onHomeClick={
                        goHome
                    }
                    onCreateClick={
                        goCreate
                    }
                    onExploreClick={
                        goExplore
                    }
                />

                <section
                    className={
                        styles.loadingState
                    }
                >
                    <div
                        className={
                            styles.loadingDot
                        }
                    />

                    Loading profile…
                </section>
            </main>
        );
    }

    /*
     * ======================================================
     * ERROR
     * ======================================================
     */

    if (
        !profile ||
        errorMessage
    ) {
        return (
            <main
                className={
                    styles.page
                }
            >
                <SiteNav
                    userId={
                        currentUserId
                    }
                    onHomeClick={
                        goHome
                    }
                    onCreateClick={
                        goCreate
                    }
                    onExploreClick={
                        goExplore
                    }
                />

                <section
                    className={
                        styles.notFound
                    }
                >
                    <p>
                        COMMUNITY PROFILE
                    </p>

                    <h1>
                        Profile unavailable.
                    </h1>

                    <span>
                        {errorMessage ||
                            "This profile could not be found."}
                    </span>

                    <button
                        type="button"
                        onClick={
                            goExplore
                        }
                    >
                        Explore memes
                    </button>
                </section>
            </main>
        );
    }

    /*
     * ======================================================
     * PAGE
     * ======================================================
     */

    return (
        <main
            className={
                styles.page
            }
        >
            <SiteNav
                userId={
                    currentUserId
                }
                onHomeClick={
                    goHome
                }
                onCreateClick={
                    goCreate
                }
                onExploreClick={
                    goExplore
                }
            />

            {/* =================================================
                PROFILE HERO
            ================================================= */}

            <section
                className={
                    styles.profileHero
                }
            >
                <div
                    className={
                        styles.profileHeroInner
                    }
                >
                    <div
                        className={
                            styles.identityArea
                        }
                    >
                        <div
                            className={
                                styles.largeAvatar
                            }
                        >
                            {profile.avatar_url ? (
                                <img
                                    src={
                                        profile.avatar_url
                                    }
                                    alt={`${displayName} profile`}
                                />
                            ) : (
                                <span>
                                    {displayName
                                        .charAt(
                                            0
                                        )
                                        .toUpperCase()}
                                </span>
                            )}
                        </div>

                        <div
                            className={
                                styles.identityCopy
                            }
                        >
                            <p
                                className={
                                    styles.eyebrow
                                }
                            >
                                COMMUNITY PROFILE
                            </p>

                            <h1>
                                {
                                    displayName
                                }
                            </h1>

                            <p
                                className={
                                    styles.tagline
                                }
                            >
                                Creating campus chaos, one meme at a time.
                            </p>

                            {currentUserId ===
                                profileUserId && (
                                    <button
                                        type="button"
                                        className={
                                            styles.editProfileButton
                                        }
                                        onClick={() =>
                                            router.push(
                                                "/profile"
                                            )
                                        }
                                    >
                                        Edit profile
                                    </button>
                                )}
                        </div>
                    </div>

                    <div
                        className={
                            styles.stats
                        }
                    >
                        <div
                            className={
                                styles.statCard
                            }
                        >
                            <strong>
                                {
                                    posts.length
                                }
                            </strong>

                            <span>
                                Posts
                            </span>
                        </div>

                        <div
                            className={
                                styles.statCard
                            }
                        >
                            <strong>
                                {
                                    totalFunnyVotes
                                }
                            </strong>

                            <span>
                                Funny votes
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* =================================================
                POSTS
            ================================================= */}

            <section
                className={
                    styles.postsSection
                }
            >
                <div
                    className={
                        styles.postsHeader
                    }
                >
                    <div>
                        <p
                            className={
                                styles.postsEyebrow
                            }
                        >
                            CREATIONS
                        </p>

                        <h2>
                            Posts
                        </h2>
                    </div>

                    <span
                        className={
                            styles.postCount
                        }
                    >
                        {
                            posts.length
                        }{" "}
                        {posts.length ===
                        1
                            ? "post"
                            : "posts"}
                    </span>
                </div>

                {posts.length ===
                0 ? (
                    <div
                        className={
                            styles.emptyPosts
                        }
                    >
                        <p>
                            No memes yet.
                        </p>

                        <span>
                            This creator hasn&apos;t posted anything yet.
                        </span>
                    </div>
                ) : (
                    <div
                        className={
                            styles.postsGrid
                        }
                    >
                        {posts.map(
                            (
                                post
                            ) => {
                                const funny =
                                    voteCounts[
                                        post.id
                                        ]
                                        ?.funny ??
                                    0;

                                return (
                                    <Link
                                        key={
                                            post.id
                                        }
                                        href={`/meme/${post.id}`}
                                        scroll={
                                            true
                                        }
                                        className={
                                            styles.postCard
                                        }
                                    >
                                        <div
                                            className={
                                                styles.postImage
                                            }
                                        >
                                            <img
                                                src={
                                                    post.image_url
                                                }
                                                alt=""
                                            />
                                        </div>

                                        <div
                                            className={
                                                styles.postBody
                                            }
                                        >
                                            <h3>
                                                {
                                                    post.caption
                                                }
                                            </h3>

                                            <div
                                                className={
                                                    styles.postMeta
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.funnyCount
                                                    }
                                                >
                                                    ↑ Funny{" "}
                                                    {
                                                        funny
                                                    }
                                                </span>

                                                <span>
                                                    {formatDate(
                                                        post.created_at
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            }
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}