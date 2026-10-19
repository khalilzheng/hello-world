"use client";

import Link from "next/link";

import {
    ChangeEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    flushSync,
} from "react-dom";

import {
    useRouter,
    useSearchParams,
} from "next/navigation";

import {
    createClient,
} from "@/utils/supabase/client";

import SiteNav from "@/app/components/SiteNav";

import {
    clearPendingMeme,
    clearResumeMemeCookie,
    readPendingMeme,
    savePendingMemeForSignup,
    updatePendingMeme,
} from "@/app/lib/pendingMeme";

import styles from "./MemeDashboard.module.css";


type DashboardView =
    | "home"
    | "explore";


type FeedMode =
    | "new"
    | "top";


type Generation = {
    id: string;

    created_at: string;

    user_id: string;

    image_url: string;

    prompt: string;

    caption: string;
};


type PublicProfile = {
    id: string;

    first_name:
        | string
        | null;

    last_name:
        | string
        | null;

    avatar_url:
        | string
        | null;
};


type VoteCount = {
    generation_id: string;

    funny: number;

    not_funny: number;

    score: number;
};


type DashboardProps = {
    userId?:
        | string
        | null;

    initialView?:
        DashboardView;

    focusCreate?:
        boolean;
};


type TrialResult = {
    imageUrl: string;

    caption: string;
};


type AuthModalReason =
    | "create"
    | "upload"
    | "vote";


const FALLBACK_PROMPTS = [
    "Write one short meme caption about a Columbia student surviving finals week. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about studying at Butler Library at 2 AM. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about opening CourseWorks and seeing too many assignments due tonight. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about dealing with the 1 train as a Columbia student. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about a Columbia group project where one person does all the work. Use the image naturally. Maximum 12 words.",
];


const TRIAL_PROMPTS = [
    "Make this image a short Columbia finals week meme. Use the image naturally. Maximum 12 words.",

    "Make this image a short Columbia group project meme. Use the image naturally. Maximum 12 words.",

    "Make this image a short late-night college meme. Use the image naturally. Maximum 12 words.",
];


const QUICK_REWRITES = [
    {
        id: "finals",

        icon: "📚",

        title: "Finals week",

        description:
            "Give it finals-week energy.",

        prompt:
            "Make it about Columbia finals week",
    },

    {
        id: "dramatic",

        icon: "🎭",

        title: "More dramatic",

        description:
            "Turn the reaction all the way up.",

        prompt:
            "Make it much more dramatic and exaggerated",
    },

    {
        id: "awkward",

        icon: "😬",

        title: "Awkward & relatable",

        description:
            "Make it painfully familiar.",

        prompt:
            "Make it awkward, relatable, and painfully accurate for college students",
    },
];


function shufflePosts(
    posts: Generation[]
) {
    const copy =
        [...posts];

    for (
        let i =
            copy.length - 1;

        i > 0;

        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            copy[i],
            copy[j],
        ] = [
            copy[j],
            copy[i],
        ];
    }

    return copy;
}


export default function MemeDashboard({
                                          userId = null,

                                          initialView =
                                          "home",

                                          focusCreate =
                                          false,
                                      }: DashboardProps) {
    const router =
        useRouter();


    const searchParams =
        useSearchParams();


    const supabase =
        useMemo(
            () =>
                createClient(),

            []
        );


    /*
     * ======================================================
     * AUTH
     * ======================================================
     */

    const [
        currentUserId,
        setCurrentUserId,
    ] =
        useState<
            string | null
        >(userId);


    const lastAuthIdRef =
        useRef<
            string | null
        >(userId);


    useEffect(() => {
        let mounted =
            true;


        async function syncUser() {
            const {
                data: {
                    user,
                },
            } =
                await supabase.auth.getUser();


            if (
                !mounted
            ) {
                return;
            }


            const nextId =
                user?.id ??
                null;


            setCurrentUserId(
                nextId
            );


            if (
                nextId !==
                lastAuthIdRef.current
            ) {
                lastAuthIdRef.current =
                    nextId;

                router.refresh();
            }
        }


        void syncUser();


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
                    const nextId =
                        session
                            ?.user
                            ?.id ??
                        null;


                    setCurrentUserId(
                        nextId
                    );


                    if (
                        nextId !==
                        lastAuthIdRef.current
                    ) {
                        lastAuthIdRef.current =
                            nextId;

                        router.refresh();
                    }
                }
            );


        return () => {
            mounted =
                false;

            subscription.unsubscribe();
        };
    }, [
        router,
        supabase,
    ]);


    /*
     * ======================================================
     * AUTH MODAL
     * ======================================================
     */

    const [
        authModalOpen,
        setAuthModalOpen,
    ] =
        useState(false);


    const [
        authModalReason,
        setAuthModalReason,
    ] =
        useState<AuthModalReason>(
            "create"
        );


    function openAuthModal(
        reason:
        AuthModalReason
    ) {
        setAuthModalReason(
            reason
        );

        setAuthModalOpen(
            true
        );
    }


    function closeAuthModal() {
        setAuthModalOpen(
            false
        );
    }


    function getAuthModalCopy() {
        if (
            authModalReason ===
            "upload"
        ) {
            return {
                eyebrow:
                    "UPLOAD YOUR OWN IMAGE",

                title:
                    "Log in to create your meme.",

                description:
                    "Uploading your own image creates a meme tied to your account.",
            };
        }


        if (
            authModalReason ===
            "vote"
        ) {
            return {
                eyebrow:
                    "JOIN THE COMMUNITY",

                title:
                    "Log in to vote.",

                description:
                    "Votes are connected to accounts so community rankings stay fair.",
            };
        }


        return {
            eyebrow:
                "CREATE & PUBLISH",

            title:
                "Log in to make it yours.",

            description:
                "Upload your own images, publish memes, vote, and build your profile.",
        };
    }


    const authModalCopy =
        getAuthModalCopy();


    /*
     * ======================================================
     * PAGE VIEW
     * ======================================================
     */

    const [
        view,
        setView,
    ] =
        useState<DashboardView>(
            initialView
        );


    /*
     * ======================================================
     * NEW / TOP
     * ======================================================
     *
     * The URL is now the persistent source
     * for which tab should be selected after
     * a browser refresh.
     *
     * ?sort=top
     *      -> Top
     *
     * ?sort=new
     * or no sort
     *      -> New
     */

    const initialFeedMode:
        FeedMode =
        searchParams.get(
            "sort"
        ) === "top"
            ? "top"
            : "new";


    const [
        feedMode,
        setFeedMode,
    ] =
        useState<FeedMode>(
            initialFeedMode
        );


    /*
     * ======================================================
     * TOP RANKING SNAPSHOT
     * ======================================================
     *
     * Top is ranked once when it is entered.
     *
     * A vote immediately changes:
     *
     * - the count
     * - the selected state
     * - the animation
     * - Supabase
     *
     * But it DOES NOT change card positions.
     *
     * Refreshing the browser destroys this
     * snapshot and creates a fresh ranking
     * from the current database values.
     */

    const [
        topSnapshotIds,
        setTopSnapshotIds,
    ] =
        useState<
            string[] | null
        >(null);


    const textareaRef =
        useRef<HTMLTextAreaElement | null>(
            null
        );


    const trialSectionRef =
        useRef<HTMLDivElement | null>(
            null
        );


    const [
        composerPulse,
        setComposerPulse,
    ] =
        useState(false);


    /*
     * ======================================================
     * CREATE
     * ======================================================
     */

    const [
        imageFile,
        setImageFile,
    ] =
        useState<File | null>(
            null
        );


    const [
        imagePreview,
        setImagePreview,
    ] =
        useState("");


    const [
        prompt,
        setPrompt,
    ] =
        useState("");


    const [
        generating,
        setGenerating,
    ] =
        useState(false);


    const [
        suggesting,
        setSuggesting,
    ] =
        useState(false);


    const [
        message,
        setMessage,
    ] =
        useState("");


    /*
     * ======================================================
     * FEED
     * ======================================================
     */

    const [
        generations,
        setGenerations,
    ] =
        useState<
            Generation[]
        >([]);


    const [
        profiles,
        setProfiles,
    ] =
        useState<
            Record<
                string,
                PublicProfile
            >
        >({});


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
        userVotes,
        setUserVotes,
    ] =
        useState<
            Record<
                string,
                1 | -1
            >
        >({});


    const [
        loadingFeed,
        setLoadingFeed,
    ] =
        useState(true);


    const [
        deletingId,
        setDeletingId,
    ] =
        useState<
            string | null
        >(null);


    /*
     * Prevent duplicate vote requests
     * without disabling the visual button.
     */

    const voteLocksRef =
        useRef<
            Set<string>
        >(
            new Set()
        );


    const [
        voteAnimation,
        setVoteAnimation,
    ] =
        useState<{
            generationId:
                string;

            type:
                | "funny"
                | "notFunny";
        } | null>(
            null
        );


    /*
     * ======================================================
     * HERO
     * ======================================================
     */

    const [
        heroPostId,
        setHeroPostId,
    ] =
        useState<
            string | null
        >(null);


    /*
     * ======================================================
     * QUICK START / GUEST TRIAL
     * ======================================================
     */

    const [
        trialLoadingId,
        setTrialLoadingId,
    ] =
        useState<
            string | null
        >(null);


    const [
        trialResult,
        setTrialResult,
    ] =
        useState<
            TrialResult | null
        >(null);


    const [
        showTrialSuccess,
        setShowTrialSuccess,
    ] =
        useState(false);


    const [
        trialSourcePost,
        setTrialSourcePost,
    ] =
        useState<
            Generation | null
        >(null);


    const [
        trialPromptUsed,
        setTrialPromptUsed,
    ] =
        useState("");


    const [
        trialCustomPrompt,
        setTrialCustomPrompt,
    ] =
        useState("");


    const [
        trialRegenerating,
        setTrialRegenerating,
    ] =
        useState(false);


    const [
        quickRewriteLoading,
        setQuickRewriteLoading,
    ] =
        useState<
            string | null
        >(null);


    const [
        trialRegenerateError,
        setTrialRegenerateError,
    ] =
        useState("");


    const [
        captionFlash,
        setCaptionFlash,
    ] =
        useState(false);


    const [
        postingTrial,
        setPostingTrial,
    ] =
        useState(false);


    const [
        resumedPendingMeme,
        setResumedPendingMeme,
    ] =
        useState(false);


    const resumeHandledRef =
        useRef(false);


    /*
     * ======================================================
     * RESTORE GUEST MEME AFTER SIGNUP
     * ======================================================
     */

    useEffect(() => {
        if (
            !currentUserId
        ) {
            return;
        }


        if (
            resumeHandledRef.current
        ) {
            return;
        }


        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }


        const params =
            new URLSearchParams(
                window.location.search
            );


        if (
            params.get(
                "resume"
            ) !==
            "meme"
        ) {
            return;
        }


        resumeHandledRef.current =
            true;


        clearResumeMemeCookie();


        const pending =
            readPendingMeme();


        if (
            !pending
        ) {
            setMessage(
                "We couldn’t restore the saved preview."
            );

            return;
        }


        const restoredSource:
            Generation =
            {
                id:
                pending
                    .sourcePost
                    .id,

                created_at:
                pending
                    .sourcePost
                    .created_at,

                user_id:
                pending
                    .sourcePost
                    .user_id,

                image_url:
                pending
                    .sourcePost
                    .image_url,

                prompt:
                pending
                    .sourcePost
                    .prompt,

                caption:
                pending
                    .sourcePost
                    .caption,
            };


        setTrialSourcePost(
            restoredSource
        );


        setTrialResult({
            imageUrl:
            pending.imageUrl,

            caption:
            pending.caption,
        });


        setTrialPromptUsed(
            pending.prompt
        );


        setTrialCustomPrompt(
            ""
        );


        setTrialRegenerateError(
            ""
        );


        setQuickRewriteLoading(
            null
        );


        setResumedPendingMeme(
            true
        );


        setShowTrialSuccess(
            true
        );
    }, [
        currentUserId,
    ]);


    /*
     * ======================================================
     * HELPERS
     * ======================================================
     */

    function getVoteCount(
        generationId:
        string
    ) {
        return (
            voteCounts[
                generationId
                ] ?? {
                generation_id:
                generationId,

                funny: 0,

                not_funny: 0,

                score: 0,
            }
        );
    }


    function getDisplayName(
        profile:
            | PublicProfile
            | undefined
    ) {
        if (
            !profile
        ) {
            return "Campus creator";
        }


        const name =
            [
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
    }


    function formatDate(
        value:
        string
    ) {
        const date =
            new Date(
                value
            );


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
            date
        );
    }


    function flashNewCaption() {
        setCaptionFlash(
            false
        );


        requestAnimationFrame(
            () => {
                setCaptionFlash(
                    true
                );


                window.setTimeout(
                    () => {
                        setCaptionFlash(
                            false
                        );
                    },
                    900
                );
            }
        );
    }


    function syncRestoredPendingMeme(
        result:
        TrialResult,

        promptUsed:
        string,

        sourcePost:
        Generation
    ) {
        if (
            !resumedPendingMeme
        ) {
            return;
        }


        updatePendingMeme({
            version: 1,

            imageUrl:
            result.imageUrl,

            caption:
            result.caption,

            prompt:
            promptUsed,

            sourcePost,

            savedAt:
                Date.now(),
        });
    }


    /*
     * ======================================================
     * URL HELPERS
     * ======================================================
     */

    function buildDashboardUrl(
        nextView:
        DashboardView,

        nextFeedMode:
        FeedMode,

        focus =
        false
    ) {
        const params =
            new URLSearchParams();


        if (
            nextView ===
            "explore"
        ) {
            params.set(
                "view",
                "explore"
            );
        }


        params.set(
            "sort",
            nextFeedMode
        );


        if (
            focus
        ) {
            params.set(
                "focus",
                "create"
            );
        }


        return `/dashboard?${params.toString()}`;
    }


    function setUrl(
        url:
        string
    ) {
        window.history.replaceState(
            null,
            "",
            url
        );
    }


    /*
     * ======================================================
     * PUBLIC PROFILES
     * ======================================================
     */

    const loadPublicProfiles =
        useCallback(
            async (
                userIds:
                string[]
            ) => {
                if (
                    userIds.length ===
                    0
                ) {
                    setProfiles(
                        {}
                    );

                    return;
                }


                const results =
                    await Promise.all(
                        userIds.map(
                            async (
                                profileUserId
                            ) => {
                                const {
                                    data,
                                    error,
                                } =
                                    await supabase.rpc(
                                        "get_public_profile",
                                        {
                                            target_user_id:
                                            profileUserId,
                                        }
                                    );


                                if (
                                    error
                                ) {
                                    console.warn(
                                        `Could not load public profile ${profileUserId}:`,
                                        error
                                    );

                                    return null;
                                }


                                const raw =
                                    Array.isArray(
                                        data
                                    )
                                        ? data[0]
                                        : data;


                                if (
                                    !raw
                                ) {
                                    return null;
                                }


                                const row =
                                    raw as {
                                        id?:
                                            string;

                                        user_id?:
                                            string;

                                        first_name?:
                                            | string
                                            | null;

                                        last_name?:
                                            | string
                                            | null;

                                        avatar_url?:
                                            | string
                                            | null;
                                    };


                                return {
                                    id:
                                        row.id ??
                                        row.user_id ??
                                        profileUserId,

                                    first_name:
                                        row.first_name ??
                                        null,

                                    last_name:
                                        row.last_name ??
                                        null,

                                    avatar_url:
                                        row.avatar_url ??
                                        null,
                                } satisfies PublicProfile;
                            }
                        )
                    );


                const nextProfiles:
                    Record<
                        string,
                        PublicProfile
                    > =
                    {};


                results.forEach(
                    (
                        profile
                    ) => {
                        if (
                            !profile
                        ) {
                            return;
                        }


                        nextProfiles[
                            profile.id
                            ] =
                            profile;
                    }
                );


                setProfiles(
                    nextProfiles
                );
            },

            [
                supabase,
            ]
        );


    /*
     * ======================================================
     * LOAD FEED
     * ======================================================
     */

    const loadFeed =
        useCallback(
            async () => {
                setLoadingFeed(
                    true
                );


                try {
                    const {
                        data:
                            generationRows,

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
                        throw generationsError;
                    }


                    const safeGenerations =
                        (
                            generationRows ??
                            []
                        ) as Generation[];


                    setGenerations(
                        safeGenerations
                    );


                    const {
                        data:
                            publicCounts,

                        error:
                            countsError,
                    } =
                        await supabase.rpc(
                            "get_public_vote_counts"
                        );


                    if (
                        countsError
                    ) {
                        console.warn(
                            "Could not load public vote counts:",
                            countsError
                        );
                    }


                    const nextCounts:
                        Record<
                            string,
                            VoteCount
                        > =
                        {};


                    (
                        (
                            publicCounts ??
                            []
                        ) as VoteCount[]
                    ).forEach(
                        (
                            row
                        ) => {
                            nextCounts[
                                row.generation_id
                                ] =
                                {
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


                    const userIds =
                        Array.from(
                            new Set(
                                safeGenerations.map(
                                    (
                                        generation
                                    ) =>
                                        generation.user_id
                                )
                            )
                        );


                    await loadPublicProfiles(
                        userIds
                    );


                    if (
                        currentUserId
                    ) {
                        const {
                            data:
                                ownVoteRows,

                            error:
                                ownVotesError,
                        } =
                            await supabase
                                .from(
                                    "votes"
                                )
                                .select(`
                                    generation_id,
                                    vote
                                `)
                                .eq(
                                    "user_id",
                                    currentUserId
                                );


                        if (
                            ownVotesError
                        ) {
                            console.warn(
                                ownVotesError
                            );
                        } else {
                            const nextUserVotes:
                                Record<
                                    string,
                                    1 | -1
                                > =
                                {};


                            (
                                ownVoteRows ??
                                []
                            ).forEach(
                                (
                                    vote
                                ) => {
                                    if (
                                        vote.vote ===
                                        1 ||
                                        vote.vote ===
                                        -1
                                    ) {
                                        nextUserVotes[
                                            vote.generation_id
                                            ] =
                                            vote.vote;
                                    }
                                }
                            );


                            setUserVotes(
                                nextUserVotes
                            );
                        }
                    } else {
                        setUserVotes(
                            {}
                        );
                    }
                } catch (
                    error
                    ) {
                    console.warn(
                        error
                    );


                    setMessage(
                        "Couldn’t load the community feed."
                    );
                } finally {
                    setLoadingFeed(
                        false
                    );
                }
            },

            [
                currentUserId,
                loadPublicProfiles,
                supabase,
            ]
        );


    useEffect(() => {
        void loadFeed();
    }, [
        loadFeed,
    ]);


    /*
     * ======================================================
     * LIVE TOP RANKING
     * ======================================================
     *
     * This recalculates whenever vote counts change.
     *
     * Community Top does NOT render this live order
     * once a snapshot has been captured.
     */

    const topPosts =
        useMemo(
            () => {
                return [
                    ...generations,
                ].sort(
                    (
                        a,
                        b
                    ) => {
                        const aVotes =
                            voteCounts[
                                a.id
                                ] ?? {
                                generation_id:
                                a.id,

                                funny: 0,

                                not_funny: 0,

                                score: 0,
                            };


                        const bVotes =
                            voteCounts[
                                b.id
                                ] ?? {
                                generation_id:
                                b.id,

                                funny: 0,

                                not_funny: 0,

                                score: 0,
                            };


                        if (
                            bVotes.funny !==
                            aVotes.funny
                        ) {
                            return (
                                bVotes.funny -
                                aVotes.funny
                            );
                        }


                        if (
                            bVotes.score !==
                            aVotes.score
                        ) {
                            return (
                                bVotes.score -
                                aVotes.score
                            );
                        }


                        return (
                            new Date(
                                b.created_at
                            ).getTime() -
                            new Date(
                                a.created_at
                            ).getTime()
                        );
                    }
                );
            },

            [
                generations,
                voteCounts,
            ]
        );


    /*
     * ======================================================
     * INITIAL TOP SNAPSHOT AFTER PAGE REFRESH
     * ======================================================
     *
     * Important case:
     *
     * /dashboard?sort=top
     * ↓
     * browser refresh
     * ↓
     * data loads
     * ↓
     * current DB ranking is captured once
     *
     * After that, votes cannot reorder cards
     * until the next refresh / re-entry.
     */

    useEffect(() => {
        if (
            feedMode !==
            "top"
        ) {
            return;
        }


        if (
            topSnapshotIds !==
            null
        ) {
            return;
        }


        if (
            loadingFeed
        ) {
            return;
        }


        if (
            generations.length ===
            0
        ) {
            return;
        }


        setTopSnapshotIds(
            topPosts.map(
                (
                    post
                ) =>
                    post.id
            )
        );
    }, [
        feedMode,
        topSnapshotIds,
        loadingFeed,
        generations.length,
        topPosts,
    ]);


    /*
     * ======================================================
     * NEW / TOP TAB CHANGE
     * ======================================================
     */

    function changeFeedMode(
        nextMode:
        FeedMode
    ) {
        if (
            nextMode ===
            feedMode
        ) {
            return;
        }


        /*
         * ==================================================
         * ENTER TOP
         * ==================================================
         *
         * Capture current order.
         */

        if (
            nextMode ===
            "top"
        ) {
            if (
                topPosts.length >
                0
            ) {
                setTopSnapshotIds(
                    topPosts.map(
                        (
                            post
                        ) =>
                            post.id
                    )
                );
            } else {
                /*
                 * Feed may still be loading.
                 *
                 * Leave snapshot null and the effect
                 * above will capture it after load.
                 */
                setTopSnapshotIds(
                    null
                );
            }


            setFeedMode(
                "top"
            );


            /*
             * Persist current mode into URL.
             *
             * No Next navigation.
             * No page refresh.
             * No loading state.
             */

            setUrl(
                buildDashboardUrl(
                    view,
                    "top"
                )
            );


            return;
        }


        /*
         * ==================================================
         * ENTER NEW
         * ==================================================
         */

        setFeedMode(
            "new"
        );


        /*
         * Throw away old Top snapshot.
         *
         * When Top is entered again,
         * it will calculate a new ranking.
         */

        setTopSnapshotIds(
            null
        );


        setUrl(
            buildDashboardUrl(
                view,
                "new"
            )
        );
    }


    /*
     * ======================================================
     * TRIAL POSTS
     * ======================================================
     */

    const trialPosts =
        useMemo(
            () => {
                if (
                    generations.length ===
                    0
                ) {
                    return [];
                }


                const topIds =
                    new Set(
                        topPosts
                            .slice(
                                0,
                                6
                            )
                            .map(
                                (
                                    post
                                ) =>
                                    post.id
                            )
                    );


                let candidates =
                    generations.filter(
                        (
                            post
                        ) =>
                            !topIds.has(
                                post.id
                            )
                    );


                if (
                    candidates.length <
                    3
                ) {
                    const smallTopIds =
                        new Set(
                            topPosts
                                .slice(
                                    0,
                                    3
                                )
                                .map(
                                    (
                                        post
                                    ) =>
                                        post.id
                                )
                        );


                    candidates =
                        generations.filter(
                            (
                                post
                            ) =>
                                !smallTopIds.has(
                                    post.id
                                )
                        );
                }


                if (
                    candidates.length <
                    3
                ) {
                    candidates =
                        [
                            ...generations,
                        ];
                }


                return shufflePosts(
                    candidates
                ).slice(
                    0,
                    3
                );
            },

            [
                generations,
                topPosts,
            ]
        );


    /*
     * ======================================================
     * HERO
     * ======================================================
     */

    useEffect(() => {
        if (
            generations.length ===
            0
        ) {
            return;
        }


        const highestFunny =
            Math.max(
                ...generations.map(
                    (
                        post
                    ) =>
                        (
                            voteCounts[
                                post.id
                                ] ?? {
                                funny: 0,
                            }
                        ).funny
                )
            );


        const tiedTopPosts =
            generations.filter(
                (
                    post
                ) =>
                    (
                        voteCounts[
                            post.id
                            ] ?? {
                            funny: 0,
                        }
                    ).funny ===
                    highestFunny
            );


        if (
            tiedTopPosts.length ===
            0
        ) {
            return;
        }


        if (
            heroPostId &&
            tiedTopPosts.some(
                (
                    post
                ) =>
                    post.id ===
                    heroPostId
            )
        ) {
            return;
        }


        const randomIndex =
            Math.floor(
                Math.random() *
                tiedTopPosts.length
            );


        setHeroPostId(
            tiedTopPosts[
                randomIndex
                ].id
        );
    }, [
        generations,
        voteCounts,
        heroPostId,
    ]);


    const heroPost =
        generations.find(
            (
                post
            ) =>
                post.id ===
                heroPostId
        ) ??
        topPosts[0] ??
        null;


    /*
     * ======================================================
     * COMMUNITY FEED ORDER
     * ======================================================
     */

    const feedPosts =
        useMemo(
            () => {
                /*
                 * NEW
                 */

                if (
                    feedMode ===
                    "new"
                ) {
                    return [
                        ...generations,
                    ].sort(
                        (
                            a,
                            b
                        ) =>
                            new Date(
                                b.created_at
                            ).getTime() -
                            new Date(
                                a.created_at
                            ).getTime()
                    );
                }


                /*
                 * TOP
                 *
                 * Once snapshot exists, card order
                 * remains fixed even as vote counts
                 * update.
                 */

                if (
                    topSnapshotIds
                ) {
                    const postsById =
                        new Map(
                            generations.map(
                                (
                                    post
                                ) => [
                                    post.id,
                                    post,
                                ]
                            )
                        );


                    const snapshotPosts =
                        topSnapshotIds
                            .map(
                                (
                                    id
                                ) =>
                                    postsById.get(
                                        id
                                    )
                            )
                            .filter(
                                (
                                    post
                                ): post is Generation =>
                                    Boolean(
                                        post
                                    )
                            );


                    /*
                     * If something brand new somehow
                     * arrives while Top remains open,
                     * append it rather than moving the
                     * existing cards.
                     */

                    const snapshotSet =
                        new Set(
                            topSnapshotIds
                        );


                    const missingPosts =
                        generations
                            .filter(
                                (
                                    post
                                ) =>
                                    !snapshotSet.has(
                                        post.id
                                    )
                            )
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    new Date(
                                        b.created_at
                                    ).getTime() -
                                    new Date(
                                        a.created_at
                                    ).getTime()
                            );


                    return [
                        ...snapshotPosts,
                        ...missingPosts,
                    ];
                }


                /*
                 * Very short period before the first
                 * Top snapshot is captured.
                 */

                return topPosts;
            },

            [
                feedMode,
                generations,
                topPosts,
                topSnapshotIds,
            ]
        );


    /*
     * ======================================================
     * NAVIGATION
     * ======================================================
     */

    function handleHome() {
        setView(
            "home"
        );


        setUrl(
            buildDashboardUrl(
                "home",
                feedMode
            )
        );


        window.scrollTo({
            top: 0,

            behavior:
                "smooth",
        });
    }


    function focusComposer() {
        setView(
            "home"
        );


        setUrl(
            buildDashboardUrl(
                "home",
                feedMode,
                true
            )
        );


        setComposerPulse(
            true
        );


        requestAnimationFrame(
            () => {
                textareaRef.current?.focus();
            }
        );


        window.setTimeout(
            () => {
                setComposerPulse(
                    false
                );
            },
            1300
        );
    }


    function handleExplore() {
        setView(
            "explore"
        );


        setUrl(
            buildDashboardUrl(
                "explore",
                feedMode
            )
        );


        window.scrollTo({
            top: 0,

            behavior:
                "smooth",
        });
    }


    function scrollToTrial() {
        closeAuthModal();


        window.setTimeout(
            () => {
                trialSectionRef.current?.scrollIntoView(
                    {
                        behavior:
                            "smooth",

                        block:
                            "center",
                    }
                );
            },
            100
        );
    }


    useEffect(() => {
        if (
            !focusCreate
        ) {
            return;
        }


        window.setTimeout(
            () => {
                focusComposer();
            },
            100
        );

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    /*
     * ======================================================
     * IMAGE INPUT
     * ======================================================
     */

    function handleImageChange(
        event:
        ChangeEvent<HTMLInputElement>
    ) {
        setMessage("");


        const file =
            event.target
                .files?.[0];


        if (
            !file
        ) {
            return;
        }


        const allowed =
            new Set([
                "image/png",

                "image/jpeg",

                "image/webp",

                "image/gif",
            ]);


        if (
            !allowed.has(
                file.type
            )
        ) {
            setMessage(
                "Use PNG, JPG, WEBP, or GIF."
            );


            event.target.value =
                "";


            return;
        }


        const maxBytes =
            10 *
            1024 *
            1024;


        if (
            file.size >
            maxBytes
        ) {
            setMessage(
                "Image must be 10 MB or smaller."
            );


            event.target.value =
                "";


            return;
        }


        if (
            imagePreview
        ) {
            URL.revokeObjectURL(
                imagePreview
            );
        }


        const preview =
            URL.createObjectURL(
                file
            );


        setImageFile(
            file
        );


        setImagePreview(
            preview
        );
    }


    function clearImage() {
        if (
            imagePreview
        ) {
            URL.revokeObjectURL(
                imagePreview
            );
        }


        setImageFile(
            null
        );


        setImagePreview(
            ""
        );
    }


    /*
     * ======================================================
     * SUGGEST PROMPT
     * ======================================================
     */

    async function handleSuggestPrompt() {
        setSuggesting(
            true
        );


        setMessage("");


        try {
            const response =
                await fetch(
                    "/api/suggest-prompt",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {}
                            ),
                    }
                );


            const result =
                await response.json();


            if (
                !response.ok
            ) {
                throw new Error(
                    result.error ??
                    "Could not suggest a prompt."
                );
            }


            if (
                typeof result.prompt ===
                "string" &&
                result.prompt.trim()
            ) {
                setPrompt(
                    result.prompt
                );


                textareaRef.current?.focus();


                setComposerPulse(
                    true
                );


                window.setTimeout(
                    () => {
                        setComposerPulse(
                            false
                        );
                    },
                    900
                );


                return;
            }


            throw new Error(
                "No prompt returned."
            );
        } catch {
            const random =
                FALLBACK_PROMPTS[
                    Math.floor(
                        Math.random() *
                        FALLBACK_PROMPTS.length
                    )
                    ];


            setPrompt(
                random
            );


            textareaRef.current?.focus();
        } finally {
            setSuggesting(
                false
            );
        }
    }


    /*
     * ======================================================
     * MAIN GENERATE
     * ======================================================
     */

    async function handleGenerate() {
        setMessage("");


        if (
            !currentUserId
        ) {
            openAuthModal(
                "create"
            );


            return;
        }


        if (
            !imageFile
        ) {
            setMessage(
                "Add an image first."
            );


            return;
        }


        const cleanPrompt =
            prompt.trim();


        if (
            !cleanPrompt
        ) {
            setMessage(
                "Describe the meme you want to create."
            );


            textareaRef.current?.focus();


            return;
        }


        setGenerating(
            true
        );


        setMessage(
            "Generating your meme..."
        );


        try {
            const extension =
                imageFile.name
                    .split(".")
                    .pop()
                    ?.toLowerCase() ||
                "jpg";


            const path =
                `${currentUserId}/${crypto.randomUUID()}.${extension}`;


            const {
                error:
                    uploadError,
            } =
                await supabase.storage
                    .from(
                        "meme-images"
                    )
                    .upload(
                        path,
                        imageFile,
                        {
                            cacheControl:
                                "3600",

                            upsert:
                                false,
                        }
                    );


            if (
                uploadError
            ) {
                throw uploadError;
            }


            const {
                data:
                    publicUrlData,
            } =
                supabase.storage
                    .from(
                        "meme-images"
                    )
                    .getPublicUrl(
                        path
                    );


            const imageUrl =
                publicUrlData.publicUrl;


            const response =
                await fetch(
                    "/api/generate-caption",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    imageUrl,

                                    mimeType:
                                    imageFile.type,

                                    prompt:
                                    cleanPrompt,
                                }
                            ),
                    }
                );


            const result =
                await response.json();


            if (
                !response.ok
            ) {
                throw new Error(
                    result.error ??
                    "Couldn’t generate this one."
                );
            }


            const caption =
                String(
                    result.caption ??
                    ""
                ).trim();


            if (
                !caption
            ) {
                throw new Error(
                    "The AI returned an empty caption."
                );
            }


            const {
                data:
                    newPost,

                error:
                    insertError,
            } =
                await supabase
                    .from(
                        "generations"
                    )
                    .insert({
                        user_id:
                        currentUserId,

                        image_url:
                        imageUrl,

                        prompt:
                        cleanPrompt,

                        caption,
                    })
                    .select(
                        "id"
                    )
                    .single();


            if (
                insertError
            ) {
                throw insertError;
            }


            clearImage();


            setPrompt("");


            router.push(
                `/meme/${newPost.id}?created=1`
            );
        } catch (
            error
            ) {
            console.warn(
                error
            );


            setMessage(
                error instanceof
                Error
                    ? error.message
                    : "Couldn’t generate this one. Try again in a moment."
            );
        } finally {
            setGenerating(
                false
            );
        }
    }


    /*
     * ======================================================
     * QUICK START GENERATE
     * ======================================================
     */

    async function runTrial(
        post:
        Generation,

        index:
        number
    ) {
        setTrialLoadingId(
            post.id
        );


        setTrialSourcePost(
            post
        );


        setTrialResult(
            null
        );


        setTrialCustomPrompt(
            ""
        );


        setTrialRegenerateError(
            ""
        );


        setQuickRewriteLoading(
            null
        );


        setResumedPendingMeme(
            false
        );


        setShowTrialSuccess(
            false
        );


        const trialPrompt =
            TRIAL_PROMPTS[
            index %
            TRIAL_PROMPTS.length
                ];


        setTrialPromptUsed(
            trialPrompt
        );


        try {
            const response =
                await fetch(
                    "/api/generate-caption",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    imageUrl:
                                    post.image_url,

                                    prompt:
                                    trialPrompt,

                                    guestTrial:
                                        true,
                                }
                            ),
                    }
                );


            const result =
                await response.json();


            if (
                !response.ok
            ) {
                throw new Error(
                    result.error ??
                    "Couldn’t generate the demo."
                );
            }


            const caption =
                String(
                    result.caption ??
                    ""
                ).trim();


            if (
                !caption
            ) {
                throw new Error(
                    "The AI returned an empty caption."
                );
            }


            setTrialResult({
                imageUrl:
                post.image_url,

                caption,
            });


            setShowTrialSuccess(
                true
            );
        } catch (
            error
            ) {
            setMessage(
                error instanceof
                Error
                    ? error.message
                    : "Couldn’t generate this one."
            );
        } finally {
            setTrialLoadingId(
                null
            );
        }
    }


    /*
     * ======================================================
     * QUICK START REWRITE
     * ======================================================
     */

    async function regenerateTrial(
        forcedDirection?:
        string,

        quickId?:
        string
    ) {
        if (
            !trialSourcePost
        ) {
            return;
        }


        const direction =
            (
                forcedDirection ??
                trialCustomPrompt
            ).trim();


        if (
            !direction
        ) {
            setTrialRegenerateError(
                "Tell AI what kind of joke you want first."
            );


            return;
        }


        setTrialRegenerating(
            true
        );


        setQuickRewriteLoading(
            quickId ??
            null
        );


        setTrialRegenerateError(
            ""
        );


        const fullPrompt =
            `Write one short meme caption for this image. ` +
            `Follow this user direction: "${direction}". ` +
            `Use the image naturally. Keep it concise and meme-like. Maximum 12 words.`;


        setTrialPromptUsed(
            fullPrompt
        );


        try {
            const response =
                await fetch(
                    "/api/generate-caption",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    imageUrl:
                                    trialSourcePost.image_url,

                                    prompt:
                                    fullPrompt,

                                    guestTrial:
                                        true,
                                }
                            ),
                    }
                );


            const result =
                await response.json();


            if (
                !response.ok
            ) {
                throw new Error(
                    result.error ??
                    "Couldn’t regenerate this one."
                );
            }


            const caption =
                String(
                    result.caption ??
                    ""
                ).trim();


            if (
                !caption
            ) {
                throw new Error(
                    "The AI returned an empty caption."
                );
            }


            const nextResult:
                TrialResult =
                {
                    imageUrl:
                    trialSourcePost.image_url,

                    caption,
                };


            setTrialResult(
                nextResult
            );


            syncRestoredPendingMeme(
                nextResult,

                fullPrompt,

                trialSourcePost
            );


            if (
                !forcedDirection
            ) {
                setTrialCustomPrompt(
                    ""
                );
            }


            flashNewCaption();
        } catch (
            error
            ) {
            console.warn(
                error
            );


            setTrialRegenerateError(
                error instanceof
                Error
                    ? error.message
                    : "Couldn’t regenerate this one."
            );
        } finally {
            setTrialRegenerating(
                false
            );


            setQuickRewriteLoading(
                null
            );
        }
    }


    /*
     * ======================================================
     * GUEST -> SIGNUP
     * ======================================================
     */

    function handleSaveGuestMemeAndSignup() {
        if (
            !trialResult ||
            !trialSourcePost
        ) {
            return;
        }


        savePendingMemeForSignup({
            version: 1,

            imageUrl:
            trialResult.imageUrl,

            caption:
            trialResult.caption,

            prompt:
                trialPromptUsed ||
                "Guest preview meme",

            sourcePost:
            trialSourcePost,

            savedAt:
                Date.now(),
        });


        router.push(
            "/signup"
        );
    }


    /*
     * ======================================================
     * POST QUICK START MEME
     * ======================================================
     */

    async function postTrialMeme() {
        if (
            !currentUserId ||
            !trialResult
        ) {
            return;
        }


        setPostingTrial(
            true
        );


        setTrialRegenerateError(
            ""
        );


        try {
            const {
                data:
                    newPost,

                error,
            } =
                await supabase
                    .from(
                        "generations"
                    )
                    .insert({
                        user_id:
                        currentUserId,

                        image_url:
                        trialResult.imageUrl,

                        prompt:
                            trialPromptUsed ||
                            "Quick Start meme",

                        caption:
                        trialResult.caption,
                    })
                    .select(
                        "id"
                    )
                    .single();


            if (
                error
            ) {
                throw error;
            }


            clearPendingMeme();


            setResumedPendingMeme(
                false
            );


            setShowTrialSuccess(
                false
            );


            router.push(
                `/meme/${newPost.id}?created=1`
            );
        } catch (
            error
            ) {
            console.warn(
                error
            );


            setTrialRegenerateError(
                error instanceof
                Error
                    ? error.message
                    : "Couldn’t post this meme."
            );
        } finally {
            setPostingTrial(
                false
            );
        }
    }


    /*
     * ======================================================
     * OPTIMISTIC VOTING
     * ======================================================
     *
     * Count:
     * immediate
     *
     * Animation:
     * immediate
     *
     * Supabase:
     * immediate
     *
     * Top card movement:
     * NO
     */

    async function handleVote(
        generationId:
        string,

        requestedVote:
            | 1
            | -1
    ) {
        if (
            !currentUserId
        ) {
            openAuthModal(
                "vote"
            );


            return;
        }


        if (
            voteLocksRef.current.has(
                generationId
            )
        ) {
            return;
        }


        voteLocksRef.current.add(
            generationId
        );


        setMessage("");


        const previousVote =
            userVotes[
                generationId
                ] ??
            null;


        const previousCounts =
            voteCounts[
                generationId
                ] ?? {
                generation_id:
                generationId,

                funny: 0,

                not_funny: 0,

                score: 0,
            };


        const nextVote:
            | 1
            | -1
            | null =
            previousVote ===
            requestedVote
                ? null
                : requestedVote;


        let nextFunny =
            Number(
                previousCounts.funny
            ) || 0;


        let nextNotFunny =
            Number(
                previousCounts.not_funny
            ) || 0;


        /*
         * Remove old vote locally.
         */

        if (
            previousVote ===
            1
        ) {
            nextFunny =
                Math.max(
                    0,

                    nextFunny -
                    1
                );
        }


        if (
            previousVote ===
            -1
        ) {
            nextNotFunny =
                Math.max(
                    0,

                    nextNotFunny -
                    1
                );
        }


        /*
         * Add new vote locally.
         */

        if (
            nextVote ===
            1
        ) {
            nextFunny +=
                1;
        }


        if (
            nextVote ===
            -1
        ) {
            nextNotFunny +=
                1;
        }


        const nextCounts:
            VoteCount =
            {
                generation_id:
                generationId,

                funny:
                nextFunny,

                not_funny:
                nextNotFunny,

                score:
                    nextFunny -
                    nextNotFunny,
            };


        /*
         * ==================================================
         * UPDATE SCREEN FIRST
         * ==================================================
         */

        flushSync(
            () => {
                setUserVotes(
                    (
                        current
                    ) => {
                        const updated =
                            {
                                ...current,
                            };


                        if (
                            nextVote ===
                            null
                        ) {
                            delete updated[
                                generationId
                                ];
                        } else {
                            updated[
                                generationId
                                ] =
                                nextVote;
                        }


                        return updated;
                    }
                );


                setVoteCounts(
                    (
                        current
                    ) => ({
                        ...current,

                        [generationId]:
                        nextCounts,
                    })
                );
            }
        );


        /*
         * ==================================================
         * VOTE ANIMATION
         * ==================================================
         */

        if (
            nextVote ===
            1
        ) {
            setVoteAnimation(
                null
            );


            requestAnimationFrame(
                () => {
                    requestAnimationFrame(
                        () => {
                            setVoteAnimation(
                                {
                                    generationId,

                                    type:
                                        "funny",
                                }
                            );
                        }
                    );
                }
            );
        }


        if (
            nextVote ===
            -1
        ) {
            setVoteAnimation(
                null
            );


            requestAnimationFrame(
                () => {
                    requestAnimationFrame(
                        () => {
                            setVoteAnimation(
                                {
                                    generationId,

                                    type:
                                        "notFunny",
                                }
                            );
                        }
                    );
                }
            );
        }


        window.setTimeout(
            () => {
                setVoteAnimation(
                    (
                        current
                    ) => {
                        if (
                            current?.generationId ===
                            generationId
                        ) {
                            return null;
                        }


                        return current;
                    }
                );
            },
            700
        );


        /*
         * ==================================================
         * SAVE TO SUPABASE
         * ==================================================
         */

        try {
            if (
                nextVote ===
                null
            ) {
                const {
                    error,
                } =
                    await supabase
                        .from(
                            "votes"
                        )
                        .delete()
                        .eq(
                            "user_id",
                            currentUserId
                        )
                        .eq(
                            "generation_id",
                            generationId
                        );


                if (
                    error
                ) {
                    throw error;
                }
            } else if (
                previousVote ===
                null
            ) {
                const {
                    error,
                } =
                    await supabase
                        .from(
                            "votes"
                        )
                        .insert({
                            user_id:
                            currentUserId,

                            generation_id:
                            generationId,

                            vote:
                            nextVote,
                        });


                if (
                    error
                ) {
                    throw error;
                }
            } else {
                const {
                    error,
                } =
                    await supabase
                        .from(
                            "votes"
                        )
                        .update({
                            vote:
                            nextVote,
                        })
                        .eq(
                            "user_id",
                            currentUserId
                        )
                        .eq(
                            "generation_id",
                            generationId
                        );


                if (
                    error
                ) {
                    throw error;
                }
            }


            /*
             * IMPORTANT:
             *
             * NO loadFeed()
             * NO router.refresh()
             * NO Top reordering.
             */
        } catch (
            error
            ) {
            console.warn(
                "Vote failed:",
                error
            );


            /*
             * Restore the exact previous UI.
             */

            flushSync(
                () => {
                    setUserVotes(
                        (
                            current
                        ) => {
                            const updated =
                                {
                                    ...current,
                                };


                            if (
                                previousVote ===
                                null
                            ) {
                                delete updated[
                                    generationId
                                    ];
                            } else {
                                updated[
                                    generationId
                                    ] =
                                    previousVote;
                            }


                            return updated;
                        }
                    );


                    setVoteCounts(
                        (
                            current
                        ) => ({
                            ...current,

                            [generationId]:
                            previousCounts,
                        })
                    );
                }
            );


            setMessage(
                "Couldn’t save your vote. Try again."
            );
        } finally {
            voteLocksRef.current.delete(
                generationId
            );
        }
    }


    /*
     * ======================================================
     * DELETE POST
     * ======================================================
     */

    async function deletePost(
        generationId:
        string
    ) {
        if (
            !currentUserId
        ) {
            return;
        }


        if (
            !window.confirm(
                "Delete this post? This cannot be undone."
            )
        ) {
            return;
        }


        setDeletingId(
            generationId
        );


        try {
            const {
                error,
            } =
                await supabase
                    .from(
                        "generations"
                    )
                    .delete()
                    .eq(
                        "id",
                        generationId
                    )
                    .eq(
                        "user_id",
                        currentUserId
                    );


            if (
                error
            ) {
                throw error;
            }


            /*
             * Delete can reload the feed.
             * Voting cannot.
             */

            await loadFeed();
        } catch (
            error
            ) {
            console.warn(
                error
            );


            setMessage(
                "Couldn’t delete this post."
            );
        } finally {
            setDeletingId(
                null
            );
        }
    }


    /*
     * ======================================================
     * POST CARD
     * ======================================================
     */

    function renderPostCard(
        post:
        Generation
    ) {
        const counts =
            getVoteCount(
                post.id
            );


        const ownVote =
            userVotes[
                post.id
                ];


        const profile =
            profiles[
                post.user_id
                ];


        const displayName =
            getDisplayName(
                profile
            );


        const isMine =
            currentUserId ===
            post.user_id;


        const profileHref =
            isMine
                ? "/profile"
                : `/user/${post.user_id}`;


        return (
            <article
                key={
                    post.id
                }
                className={
                    styles.postCard
                }
            >
                <Link
                    href={`/meme/${post.id}`}
                    className={
                        styles.cardImageLink
                    }
                >
                    <div
                        className={
                            styles.cardImage
                        }
                    >
                        <img
                            src={
                                post.image_url
                            }
                            alt=""
                        />
                    </div>
                </Link>


                <div
                    className={
                        styles.cardBody
                    }
                >
                    <Link
                        href={
                            profileHref
                        }
                        className={
                            styles.authorRow
                        }
                    >
                        <div
                            className={
                                styles.authorAvatar
                            }
                        >
                            {profile?.avatar_url ? (
                                <img
                                    src={
                                        profile.avatar_url
                                    }
                                    alt=""
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
                                styles.authorText
                            }
                        >
                            <strong>
                                {
                                    displayName
                                }
                            </strong>

                            <small>
                                View profile
                            </small>
                        </div>


                        {isMine && (
                            <span
                                className={
                                    styles.youBadge
                                }
                            >
                                You
                            </span>
                        )}
                    </Link>


                    <Link
                        href={`/meme/${post.id}`}
                        className={
                            styles.captionLink
                        }
                    >
                        <h3>
                            {
                                post.caption
                            }
                        </h3>
                    </Link>


                    <p
                        className={
                            styles.cardPrompt
                        }
                    >
                        Prompt:{" "}
                        {
                            post.prompt
                        }
                    </p>


                    <div
                        className={
                            styles.cardMeta
                        }
                    >
                        <span>
                            {formatDate(
                                post.created_at
                            )}
                        </span>


                        <span>
                            Score{" "}
                            {
                                counts.score
                            }
                        </span>
                    </div>


                    <div
                        className={
                            styles.voteShell
                        }
                    >
                        <button
                            type="button"
                            aria-pressed={
                                ownVote ===
                                1
                            }
                            className={[
                                styles.voteButton,

                                ownVote ===
                                1
                                    ? styles.funnySelected
                                    : "",

                                voteAnimation?.generationId ===
                                post.id &&
                                voteAnimation.type ===
                                "funny"
                                    ? styles.funnyVoteFlash
                                    : "",
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " "
                                )}
                            onClick={() =>
                                void handleVote(
                                    post.id,

                                    1
                                )
                            }
                        >
                            <span
                                className={
                                    styles.voteGradient
                                }
                            />


                            <span
                                className={
                                    styles.voteArrow
                                }
                            >
                                ↑
                            </span>


                            <span
                                className={
                                    styles.voteText
                                }
                            >
                                Funny
                            </span>


                            <strong
                                className={
                                    styles.voteNumber
                                }
                            >
                                {
                                    counts.funny
                                }
                            </strong>
                        </button>


                        <button
                            type="button"
                            aria-pressed={
                                ownVote ===
                                -1
                            }
                            className={[
                                styles.voteButton,

                                ownVote ===
                                -1
                                    ? styles.notFunnySelected
                                    : "",

                                voteAnimation?.generationId ===
                                post.id &&
                                voteAnimation.type ===
                                "notFunny"
                                    ? styles.notFunnyVoteFlash
                                    : "",
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " "
                                )}
                            onClick={() =>
                                void handleVote(
                                    post.id,

                                    -1
                                )
                            }
                        >
                            <span
                                className={
                                    styles.voteGradient
                                }
                            />


                            <span
                                className={
                                    styles.voteArrow
                                }
                            >
                                ↓
                            </span>


                            <span
                                className={
                                    styles.voteText
                                }
                            >
                                Not Funny
                            </span>


                            <strong
                                className={
                                    styles.voteNumber
                                }
                            >
                                {
                                    counts.not_funny
                                }
                            </strong>
                        </button>
                    </div>


                    {isMine && (
                        <button
                            type="button"
                            className={
                                styles.deleteButton
                            }
                            disabled={
                                deletingId ===
                                post.id
                            }
                            onClick={() =>
                                void deletePost(
                                    post.id
                                )
                            }
                        >
                            {deletingId ===
                            post.id
                                ? "Deleting..."
                                : "Delete post"}
                        </button>
                    )}
                </div>
            </article>
        );
    }


    /*
     * ======================================================
     * COMMUNITY
     * ======================================================
     */

    function renderCommunity(
        direct =
        false
    ) {
        return (
            <section
                id="community"
                className={[
                    styles.community,

                    direct
                        ? styles.communityDirect
                        : "",
                ]
                    .filter(
                        Boolean
                    )
                    .join(
                        " "
                    )}
            >
                <div
                    className={
                        styles.communityHeader
                    }
                >
                    <div>
                        <p
                            className={
                                styles.communityEyebrow
                            }
                        >
                            COMMUNITY
                        </p>


                        <h2>
                            Made on campus
                        </h2>
                    </div>


                    <div
                        className={
                            styles.feedToggle
                        }
                    >
                        <button
                            type="button"
                            className={
                                feedMode ===
                                "new"
                                    ? styles.feedToggleActive
                                    : ""
                            }
                            onClick={() =>
                                changeFeedMode(
                                    "new"
                                )
                            }
                        >
                            New
                        </button>


                        <button
                            type="button"
                            className={
                                feedMode ===
                                "top"
                                    ? styles.feedToggleActive
                                    : ""
                            }
                            onClick={() =>
                                changeFeedMode(
                                    "top"
                                )
                            }
                        >
                            Top
                        </button>
                    </div>
                </div>


                {!currentUserId && (
                    <div
                        className={
                            styles.browseNotice
                        }
                    >
                        <div>
                            <strong>
                                Browse freely.
                            </strong>

                            <span>
                                Log in when you want to create or vote.
                            </span>
                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    "/signup"
                                )
                            }
                        >
                            Sign up for free
                        </button>
                    </div>
                )}


                {loadingFeed ? (
                    <div
                        className={
                            styles.feedMessage
                        }
                    >
                        Loading community…
                    </div>
                ) : (
                    <div
                        className={
                            styles.postGrid
                        }
                    >
                        {feedPosts.map(
                            renderPostCard
                        )}
                    </div>
                )}
            </section>
        );
    }


    /*
     * ======================================================
     * AUTH MODAL
     * ======================================================
     */

    function renderAuthModal(
        allowTrialLink:
        boolean
    ) {
        if (
            !authModalOpen
        ) {
            return null;
        }


        return (
            <div
                className={
                    styles.authBackdrop
                }
                onClick={
                    closeAuthModal
                }
            >
                <div
                    className={
                        styles.authModal
                    }
                    onClick={(
                        event
                    ) =>
                        event.stopPropagation()
                    }
                >
                    <button
                        type="button"
                        className={
                            styles.authClose
                        }
                        onClick={
                            closeAuthModal
                        }
                    >
                        ×
                    </button>


                    <div
                        className={
                            styles.authSpark
                        }
                    >
                        ✦
                    </div>


                    <p
                        className={
                            styles.authEyebrow
                        }
                    >
                        {
                            authModalCopy.eyebrow
                        }
                    </p>


                    <h2>
                        {
                            authModalCopy.title
                        }
                    </h2>


                    <p
                        className={
                            styles.authDescription
                        }
                    >
                        {
                            authModalCopy.description
                        }
                    </p>


                    <div
                        className={
                            styles.authButtons
                        }
                    >
                        <button
                            type="button"
                            className={
                                styles.loginPrimary
                            }
                            onClick={() =>
                                router.push(
                                    "/login"
                                )
                            }
                        >
                            Log in
                        </button>


                        <button
                            type="button"
                            className={
                                styles.signupSecondary
                            }
                            onClick={() =>
                                router.push(
                                    "/signup"
                                )
                            }
                        >
                            Sign up for free
                        </button>
                    </div>


                    {allowTrialLink &&
                        trialPosts.length >
                        0 && (
                            <>
                                <div
                                    className={
                                        styles.authDivider
                                    }
                                >
                                    <span>
                                        or
                                    </span>
                                </div>


                                <button
                                    type="button"
                                    className={
                                        styles.continueTrialButton
                                    }
                                    onClick={
                                        scrollToTrial
                                    }
                                >
                                    ✦ Try Meme Lab without an account
                                </button>
                            </>
                        )}
                </div>
            </div>
        );
    }


    /*
     * ======================================================
     * EXPLORE
     * ======================================================
     */

    if (
        view ===
        "explore"
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
                        handleHome
                    }
                    onCreateClick={
                        focusComposer
                    }
                    onExploreClick={
                        handleExplore
                    }
                />


                {renderCommunity(
                    true
                )}


                {renderAuthModal(
                    false
                )}
            </main>
        );
    }


    /*
     * ======================================================
     * HOME
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
                    handleHome
                }
                onCreateClick={
                    focusComposer
                }
                onExploreClick={
                    handleExplore
                }
            />


            <section
                className={
                    styles.hero
                }
                style={
                    heroPost
                        ? {
                            backgroundImage:
                                `linear-gradient(rgba(0,0,0,.38), rgba(0,0,0,.70)), url("${heroPost.image_url}")`,
                        }
                        : undefined
                }
            >
                <div
                    className={
                        styles.heroContent
                    }
                >
                    <p
                        className={
                            styles.heroEyebrow
                        }
                    >
                        AI HUMOR FOR CAMPUS LIFE
                    </p>


                    <h1>
                        Turn campus chaos
                        <br />
                        into memes.
                    </h1>


                    <p
                        className={
                            styles.heroDescription
                        }
                    >
                        Upload a reaction image,
                        describe the moment, and
                        let AI turn Columbia life
                        into something worth
                        sharing.
                    </p>


                    <div
                        className={[
                            styles.composer,

                            composerPulse
                                ? styles.composerPulse
                                : "",
                        ]
                            .filter(
                                Boolean
                            )
                            .join(
                                " "
                            )}
                    >
                        {imageFile &&
                            imagePreview && (
                                <div
                                    className={
                                        styles.selectedImage
                                    }
                                >
                                    <img
                                        src={
                                            imagePreview
                                        }
                                        alt=""
                                    />


                                    <div>
                                        <strong>
                                            Image added
                                        </strong>

                                        <span>
                                            {
                                                imageFile.name
                                            }
                                        </span>
                                    </div>


                                    <button
                                        type="button"
                                        onClick={
                                            clearImage
                                        }
                                    >
                                        ×
                                    </button>
                                </div>
                            )}


                        <textarea
                            ref={
                                textareaRef
                            }
                            value={
                                prompt
                            }
                            onChange={(
                                event
                            ) =>
                                setPrompt(
                                    event
                                        .target
                                        .value
                                )
                            }
                            placeholder="Describe the Columbia moment you want to turn into a meme..."
                            className={
                                styles.promptInput
                            }
                        />


                        <div
                            className={
                                styles.composerActions
                            }
                        >
                            <div
                                className={
                                    styles.leftActions
                                }
                            >
                                {currentUserId ? (
                                    <label
                                        className={
                                            styles.addImageButton
                                        }
                                    >
                                        + Add image

                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/gif"
                                            onChange={
                                                handleImageChange
                                            }
                                        />
                                    </label>
                                ) : (
                                    <button
                                        type="button"
                                        className={
                                            styles.addImageButton
                                        }
                                        onClick={() =>
                                            openAuthModal(
                                                "upload"
                                            )
                                        }
                                    >
                                        + Add image
                                    </button>
                                )}


                                <button
                                    type="button"
                                    className={
                                        styles.suggestButton
                                    }
                                    disabled={
                                        suggesting
                                    }
                                    onClick={() =>
                                        void handleSuggestPrompt()
                                    }
                                >
                                    {suggesting
                                        ? "Suggesting..."
                                        : "↻ Suggest prompt"}
                                </button>
                            </div>


                            <button
                                type="button"
                                className={
                                    styles.generateButton
                                }
                                disabled={
                                    generating
                                }
                                onClick={() =>
                                    void handleGenerate()
                                }
                            >
                                {generating
                                    ? "✦ Generating..."
                                    : "✦ Generate"}
                            </button>
                        </div>


                        <p
                            className={
                                styles.fileHint
                            }
                        >
                            PNG, JPG, WEBP or GIF · Max 10 MB
                        </p>


                        {message && (
                            <p
                                className={
                                    styles.message
                                }
                            >
                                {
                                    message
                                }
                            </p>
                        )}
                    </div>


                    {trialPosts.length >
                        0 && (
                            <div
                                ref={
                                    trialSectionRef
                                }
                                className={
                                    styles.guestTrial
                                }
                            >
                                <div
                                    className={
                                        styles.trialGlow
                                    }
                                />


                                <div
                                    className={
                                        styles.guestTrialHeading
                                    }
                                >
                                    <p
                                        className={
                                            styles.trialEyebrow
                                        }
                                    >
                                        {currentUserId
                                            ? "✦ QUICK START"
                                            : "✦ NO LOGIN NEEDED"}
                                    </p>


                                    <h2>
                                        {currentUserId
                                            ? "Make a meme in one click"
                                            : "Try Meme Lab instantly"}
                                    </h2>


                                    <p>
                                        {currentUserId
                                            ? "Pick a reaction image, let AI start the joke, then post it when you like the result."
                                            : "See what Meme Lab does in seconds. Pick an image and let AI do the rest."}
                                    </p>
                                </div>


                                <div
                                    className={
                                        styles.trialImages
                                    }
                                >
                                    {trialPosts.map(
                                        (
                                            post,
                                            index
                                        ) => (
                                            <button
                                                key={
                                                    post.id
                                                }
                                                type="button"
                                                className={
                                                    styles.trialImageButton
                                                }
                                                disabled={
                                                    trialLoadingId !==
                                                    null
                                                }
                                                onClick={() =>
                                                    void runTrial(
                                                        post,

                                                        index
                                                    )
                                                }
                                            >
                                                <img
                                                    src={
                                                        post.image_url
                                                    }
                                                    alt=""
                                                />


                                                <div
                                                    className={
                                                        styles.trialOverlay
                                                    }
                                                />


                                                <span
                                                    className={
                                                        styles.trialButtonLabel
                                                    }
                                                >
                                                {trialLoadingId ===
                                                post.id ? (
                                                    <>
                                                        <span
                                                            className={
                                                                styles.miniSpinner
                                                            }
                                                        />

                                                        Generating…
                                                    </>
                                                ) : (
                                                    <>
                                                        ✦ Try this image
                                                    </>
                                                )}
                                            </span>
                                            </button>
                                        )
                                    )}
                                </div>


                                <div
                                    className={
                                        styles.trialBenefits
                                    }
                                >
                                    {currentUserId ? (
                                        <>
                                        <span>
                                            Pick a template
                                        </span>

                                            <i>
                                                •
                                            </i>

                                            <span>
                                            Rewrite it
                                        </span>

                                            <i>
                                                •
                                            </i>

                                            <span>
                                            Post when ready
                                        </span>
                                        </>
                                    ) : (
                                        <>
                                        <span>
                                            No account
                                        </span>

                                            <i>
                                                •
                                            </i>

                                            <span>
                                            No upload
                                        </span>

                                            <i>
                                                •
                                            </i>

                                            <span>
                                            Nothing gets posted
                                        </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                </div>


                <div
                    className={
                        styles.topStrip
                    }
                >
                    <div
                        className={
                            styles.topStripLabel
                        }
                    >
                        <strong>
                            Top memes
                        </strong>

                        <span>
                            Ranked by Funny votes
                        </span>
                    </div>


                    <div
                        className={
                            styles.topStripCards
                        }
                    >
                        {topPosts
                            .slice(
                                0,
                                7
                            )
                            .map(
                                (
                                    post
                                ) => (
                                    <Link
                                        key={
                                            post.id
                                        }
                                        href={`/meme/${post.id}`}
                                        className={
                                            styles.topStripCard
                                        }
                                    >
                                        <img
                                            src={
                                                post.image_url
                                            }
                                            alt=""
                                        />


                                        <span>
                                            {
                                                post.caption
                                            }
                                        </span>


                                        <small>
                                            ↑{" "}
                                            {
                                                getVoteCount(
                                                    post.id
                                                )
                                                    .funny
                                            }
                                        </small>
                                    </Link>
                                )
                            )}
                    </div>
                </div>
            </section>


            {renderCommunity()}


            {showTrialSuccess &&
                trialResult && (
                    <div
                        className={
                            styles.demoSuccessBackdrop
                        }
                        onClick={() =>
                            setShowTrialSuccess(
                                false
                            )
                        }
                    >
                        <div
                            className={
                                styles.demoSuccessCard
                            }
                            onClick={(
                                event
                            ) =>
                                event.stopPropagation()
                            }
                        >
                            <button
                                type="button"
                                className={
                                    styles.demoClose
                                }
                                onClick={() =>
                                    setShowTrialSuccess(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>


                            <div
                                className={
                                    styles.successIcon
                                }
                            >
                                ✦
                            </div>


                            <p
                                className={
                                    styles.successEyebrow
                                }
                            >
                                {resumedPendingMeme
                                    ? "WELCOME BACK"
                                    : currentUserId
                                        ? "QUICK START GENERATED"
                                        : "DEMO GENERATED"}
                            </p>


                            <h2>
                                {resumedPendingMeme
                                    ? "Your meme is still here."
                                    : "Your meme is ready."}
                            </h2>


                            <div
                                className={
                                    styles.successPreview
                                }
                            >
                                <img
                                    src={
                                        trialResult.imageUrl
                                    }
                                    alt=""
                                />
                            </div>


                            <p
                                className={[
                                    styles.successCaption,

                                    captionFlash
                                        ? styles.captionFlash
                                        : "",
                                ]
                                    .filter(
                                        Boolean
                                    )
                                    .join(
                                        " "
                                    )}
                            >
                                “
                                {
                                    trialResult.caption
                                }
                                ”
                            </p>


                            {resumedPendingMeme && (
                                <div
                                    className={
                                        styles.successNote
                                    }
                                >
                                    ✓ Account created. Your preview was saved — post it now or keep editing.
                                </div>
                            )}


                            <div
                                className={
                                    styles.remixSection
                                }
                            >
                                <div
                                    className={
                                        styles.remixHeading
                                    }
                                >
                                    <div>
                                        <strong>
                                            Want a different joke?
                                        </strong>

                                        <span>
                                            Describe how you&apos;d like to change it.
                                        </span>
                                    </div>
                                </div>


                                <div
                                    className={
                                        styles.remixInputRow
                                    }
                                >
                                    <input
                                        type="text"
                                        value={
                                            trialCustomPrompt
                                        }
                                        disabled={
                                            trialRegenerating
                                        }
                                        placeholder="Example: Make it about my professor..."
                                        onChange={(
                                            event
                                        ) => {
                                            setTrialCustomPrompt(
                                                event
                                                    .target
                                                    .value
                                            );

                                            setTrialRegenerateError(
                                                ""
                                            );
                                        }}
                                        onKeyDown={(
                                            event
                                        ) => {
                                            if (
                                                event.key ===
                                                "Enter" &&
                                                !trialRegenerating
                                            ) {
                                                void regenerateTrial();
                                            }
                                        }}
                                    />


                                    <button
                                        type="button"
                                        disabled={
                                            trialRegenerating ||
                                            !trialCustomPrompt.trim()
                                        }
                                        onClick={() =>
                                            void regenerateTrial()
                                        }
                                    >
                                        {trialRegenerating &&
                                        !quickRewriteLoading
                                            ? "✦ Rewriting…"
                                            : "↻ Regenerate"}
                                    </button>
                                </div>


                                <div
                                    className={
                                        styles.quickRewriteSection
                                    }
                                >
                                    <div
                                        className={
                                            styles.quickRewriteHeader
                                        }
                                    >
                                        <strong>
                                            Quick rewrite ideas
                                        </strong>

                                        <span>
                                            Tap one — AI rewrites the meme instantly.
                                        </span>
                                    </div>


                                    <div
                                        className={
                                            styles.quickRewriteGrid
                                        }
                                    >
                                        {QUICK_REWRITES.map(
                                            (
                                                item
                                            ) => {
                                                const isLoading =
                                                    quickRewriteLoading ===
                                                    item.id;


                                                return (
                                                    <button
                                                        key={
                                                            item.id
                                                        }
                                                        type="button"
                                                        disabled={
                                                            trialRegenerating
                                                        }
                                                        className={[
                                                            styles.quickRewriteButton,

                                                            isLoading
                                                                ? styles.quickRewriteButtonActive
                                                                : "",
                                                        ]
                                                            .filter(
                                                                Boolean
                                                            )
                                                            .join(
                                                                " "
                                                            )}
                                                        onClick={() =>
                                                            void regenerateTrial(
                                                                item.prompt,

                                                                item.id
                                                            )
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                styles.quickRewriteIcon
                                                            }
                                                        >
                                                            {isLoading
                                                                ? "✦"
                                                                : item.icon}
                                                        </span>


                                                        <span
                                                            className={
                                                                styles.quickRewriteCopy
                                                            }
                                                        >
                                                            <strong>
                                                                {isLoading
                                                                    ? "Rewriting..."
                                                                    : item.title}
                                                            </strong>

                                                            <small>
                                                                {isLoading
                                                                    ? "AI is making a new version."
                                                                    : item.description}
                                                            </small>
                                                        </span>


                                                        <span
                                                            className={
                                                                styles.quickRewriteArrow
                                                            }
                                                        >
                                                            →
                                                        </span>
                                                    </button>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>


                                {trialRegenerateError && (
                                    <p
                                        className={
                                            styles.remixError
                                        }
                                    >
                                        {
                                            trialRegenerateError
                                        }
                                    </p>
                                )}


                                <p
                                    className={
                                        styles.remixPrivacy
                                    }
                                >
                                    {currentUserId
                                        ? "Nothing is posted until you choose Post this meme."
                                        : "This preview stays private and will not be posted."}
                                </p>
                            </div>


                            {currentUserId ? (
                                <button
                                    type="button"
                                    className={
                                        styles.successSignup
                                    }
                                    disabled={
                                        postingTrial ||
                                        trialRegenerating
                                    }
                                    onClick={() =>
                                        void postTrialMeme()
                                    }
                                >
                                    {postingTrial
                                        ? "Posting..."
                                        : "Post this meme"}

                                    <span>
                                        →
                                    </span>
                                </button>
                            ) : (
                                <>
                                    <div
                                        className={
                                            styles.successNote
                                        }
                                    >
                                        Your meme will be waiting for you after signup.
                                    </div>


                                    <button
                                        type="button"
                                        className={
                                            styles.successSignup
                                        }
                                        onClick={
                                            handleSaveGuestMemeAndSignup
                                        }
                                    >
                                        Save this meme — sign up free

                                        <span>
                                            →
                                        </span>
                                    </button>
                                </>
                            )}


                            <button
                                type="button"
                                className={
                                    styles.tryAnotherButton
                                }
                                onClick={() => {
                                    if (
                                        resumedPendingMeme
                                    ) {
                                        clearPendingMeme();
                                    }


                                    setResumedPendingMeme(
                                        false
                                    );


                                    setShowTrialSuccess(
                                        false
                                    );


                                    setTrialResult(
                                        null
                                    );


                                    setTrialSourcePost(
                                        null
                                    );


                                    setTrialCustomPrompt(
                                        ""
                                    );


                                    setTrialRegenerateError(
                                        ""
                                    );


                                    setQuickRewriteLoading(
                                        null
                                    );
                                }}
                            >
                                Try another image
                            </button>
                        </div>
                    </div>
                )}


            {renderAuthModal(
                true
            )}
        </main>
    );
}