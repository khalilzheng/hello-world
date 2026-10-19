"use client";

import Link from "next/link";

import {
    MouseEvent,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    flushSync,
} from "react-dom";

import {
    useRouter,
} from "next/navigation";

import {
    createClient,
} from "@/utils/supabase/client";

import SiteNav from "@/app/components/SiteNav";

import styles from "./MemeDetail.module.css";

type Post = {
    id: string;

    created_at: string;

    user_id: string;

    image_url: string;

    caption: string;
};

type Profile = {
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

type RelatedPost = {
    id: string;

    created_at: string;

    user_id: string;

    image_url: string;

    caption: string;

    funny: number;

    not_funny: number;
};

type Props = {
    post: Post;

    profile: Profile;

    currentUserId:
        | string
        | null;

    initialFunny: number;

    initialNotFunny: number;

    initialUserVote:
        | 1
        | -1
        | null;

    showCreatedIntro:
        boolean;

    relatedPosts:
        RelatedPost[];
};

export default function MemeDetailClient({
                                             post,
                                             profile,
                                             currentUserId,
                                             initialFunny,
                                             initialNotFunny,
                                             initialUserVote,
                                             showCreatedIntro,
                                             relatedPosts,
                                         }: Props) {
    const router =
        useRouter();

    const supabase =
        useMemo(
            () =>
                createClient(),
            []
        );

    /*
     * ======================================================
     * CREATED INTRO
     * ======================================================
     */

    const [
        showIntro,
        setShowIntro,
    ] =
        useState(
            showCreatedIntro
        );

    /*
     * ======================================================
     * VOTING
     * ======================================================
     */

    const [
        funnyCount,
        setFunnyCount,
    ] =
        useState(
            initialFunny
        );

    const [
        notFunnyCount,
        setNotFunnyCount,
    ] =
        useState(
            initialNotFunny
        );

    const [
        userVote,
        setUserVote,
    ] =
        useState<
            1 | -1 | null
        >(
            initialUserVote
        );

    const [
        voteFlash,
        setVoteFlash,
    ] =
        useState<
            | "funny"
            | "notFunny"
            | null
        >(null);

    const [
        savingVote,
        setSavingVote,
    ] =
        useState(false);

    const [
        voteError,
        setVoteError,
    ] =
        useState("");

    /*
     * Prevent duplicate vote requests.
     *
     * We do NOT disable the button
     * visually because that was making
     * voting feel like a page reload.
     */

    const voteLockRef =
        useRef(false);

    /*
     * ======================================================
     * AUTH MODAL
     * ======================================================
     */

    const [
        showAuthModal,
        setShowAuthModal,
    ] =
        useState(false);

    /*
     * ======================================================
     * DELETE
     * ======================================================
     */

    const [
        deleting,
        setDeleting,
    ] =
        useState(false);

    /*
     * ======================================================
     * DISPLAY DATA
     * ======================================================
     */

    const displayName =
        [
            profile.first_name,
            profile.last_name,
        ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "Campus creator";

    const isMine =
        currentUserId ===
        post.user_id;

    const score =
        funnyCount -
        notFunnyCount;

    function formatDate(
        value: string
    ) {
        const date =
            new Date(value);

        return new Intl.DateTimeFormat(
            "en-US",
            {
                month:
                    "long",

                day:
                    "numeric",

                year:
                    "numeric",

                timeZone:
                    "UTC",
            }
        ).format(date);
    }

    /*
     * ======================================================
     * BACK BUTTON
     * ======================================================
     *
     * If the user came from Explore / Home / Profile,
     * router.back() sends them exactly where they were.
     *
     * If they opened this meme directly in a new tab,
     * fall back to Explore.
     */

    function handleBack() {
        if (
            typeof window !==
            "undefined" &&
            window.history.length >
            1
        ) {
            router.back();

            return;
        }

        router.push(
            "/dashboard?view=explore"
        );
    }

    /*
     * ======================================================
     * VOTE FLASH
     * ======================================================
     */

    function triggerVoteFlash(
        type:
            | "funny"
            | "notFunny"
    ) {
        setVoteFlash(
            null
        );

        requestAnimationFrame(
            () => {
                requestAnimationFrame(
                    () => {
                        setVoteFlash(
                            type
                        );

                        window.setTimeout(
                            () => {
                                setVoteFlash(
                                    null
                                );
                            },
                            650
                        );
                    }
                );
            }
        );
    }

    /*
     * ======================================================
     * OPTIMISTIC VOTING
     * ======================================================
     *
     * UI updates FIRST.
     *
     * Supabase saves SECOND.
     *
     * NO refresh.
     * NO router.refresh().
     * NO reload.
     * ======================================================
     */

    async function handleVote(
        event:
        MouseEvent<HTMLButtonElement>,

        requestedVote:
            1 | -1
    ) {
        event.preventDefault();

        event.stopPropagation();

        if (
            !currentUserId
        ) {
            setShowAuthModal(
                true
            );

            return;
        }

        if (
            voteLockRef.current
        ) {
            return;
        }

        voteLockRef.current =
            true;

        setVoteError("");

        /*
         * Snapshot old state.
         */

        const previousVote =
            userVote;

        const previousFunny =
            funnyCount;

        const previousNotFunny =
            notFunnyCount;

        /*
         * Clicking selected vote again
         * removes the vote.
         */

        const nextVote:
            | 1
            | -1
            | null =
            previousVote ===
            requestedVote
                ? null
                : requestedVote;

        let nextFunny =
            previousFunny;

        let nextNotFunny =
            previousNotFunny;

        /*
         * Remove previous vote.
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
         * Add new vote.
         */

        if (
            nextVote ===
            1
        ) {
            nextFunny += 1;
        }

        if (
            nextVote ===
            -1
        ) {
            nextNotFunny +=
                1;
        }

        /*
         * Update the screen immediately.
         */

        flushSync(
            () => {
                setUserVote(
                    nextVote
                );

                setFunnyCount(
                    nextFunny
                );

                setNotFunnyCount(
                    nextNotFunny
                );

                setSavingVote(
                    true
                );
            }
        );

        /*
         * Run animation immediately.
         */

        if (
            nextVote ===
            1
        ) {
            triggerVoteFlash(
                "funny"
            );
        }

        if (
            nextVote ===
            -1
        ) {
            triggerVoteFlash(
                "notFunny"
            );
        }

        /*
         * Save in background.
         */

        try {
            /*
             * Remove vote.
             */

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
                            post.id
                        );

                if (
                    error
                ) {
                    throw error;
                }
            }

            /*
             * First vote.
             */

            else if (
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
                            post.id,

                            vote:
                            nextVote,
                        });

                if (
                    error
                ) {
                    throw error;
                }
            }

            /*
             * Switch vote.
             */

            else {
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
                            post.id
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
             * Nothing else happens here.
             *
             * No refresh.
             */
        } catch (
            error
            ) {
            console.warn(
                "Vote failed:",
                error
            );

            /*
             * Roll back only if Supabase fails.
             */

            flushSync(
                () => {
                    setUserVote(
                        previousVote
                    );

                    setFunnyCount(
                        previousFunny
                    );

                    setNotFunnyCount(
                        previousNotFunny
                    );
                }
            );

            setVoteError(
                "Couldn’t save your vote. Try again."
            );
        } finally {
            voteLockRef.current =
                false;

            setSavingVote(
                false
            );
        }
    }

    /*
     * ======================================================
     * DELETE POST
     * ======================================================
     */

    async function deletePost() {
        if (
            !currentUserId ||
            !isMine
        ) {
            return;
        }

        const confirmed =
            window.confirm(
                "Delete this post? This cannot be undone."
            );

        if (
            !confirmed
        ) {
            return;
        }

        setDeleting(
            true
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
                        post.id
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

            router.push(
                "/dashboard?view=explore"
            );
        } catch (
            error
            ) {
            console.warn(
                error
            );

            setVoteError(
                "Couldn’t delete this post."
            );

            setDeleting(
                false
            );
        }
    }

    /*
     * ======================================================
     * JUST GENERATED SCREEN
     * ======================================================
     */

    if (
        showIntro
    ) {
        return (
            <main
                className={
                    styles.createdPage
                }
            >
                <div
                    className={
                        styles.createdGlowOne
                    }
                />

                <div
                    className={
                        styles.createdGlowTwo
                    }
                />

                <div
                    className={
                        styles.createdContent
                    }
                >
                    <div
                        className={
                            styles.createdSpark
                        }
                    >
                        ✦
                    </div>

                    <p
                        className={
                            styles.createdEyebrow
                        }
                    >
                        JUST GENERATED
                    </p>

                    <h1>
                        Your meme is live.
                    </h1>

                    <div
                        className={
                            styles.createdImage
                        }
                    >
                        <img
                            src={
                                post.image_url
                            }
                            alt=""
                        />
                    </div>

                    <p
                        className={
                            styles.createdCaption
                        }
                    >
                        “
                        {
                            post.caption
                        }
                        ”
                    </p>

                    <div
                        className={
                            styles.createdMeta
                        }
                    >
                        <span>
                            AI generated
                        </span>

                        <i>
                            •
                        </i>

                        <span>
                            Ready to vote
                        </span>
                    </div>

                    <div
                        className={
                            styles.createdActions
                        }
                    >
                        <button
                            type="button"
                            className={
                                styles.viewPostButton
                            }
                            onClick={() => {
                                setShowIntro(
                                    false
                                );

                                window.history.replaceState(
                                    null,
                                    "",
                                    `/meme/${post.id}`
                                );
                            }}
                        >
                            View your post

                            <span>
                                →
                            </span>
                        </button>

                        <button
                            type="button"
                            className={
                                styles.createdBackButton
                            }
                            onClick={
                                handleBack
                            }
                        >
                            ← Back to posts
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    /*
     * ======================================================
     * NORMAL DETAIL PAGE
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
                onHomeClick={() =>
                    router.push(
                        "/dashboard"
                    )
                }
                onCreateClick={() =>
                    router.push(
                        "/dashboard?focus=create"
                    )
                }
                onExploreClick={() =>
                    router.push(
                        "/dashboard?view=explore"
                    )
                }
            />

            {/* =================================================
                BACK BUTTON
            ================================================= */}

            <div
                className={
                    styles.backBar
                }
            >
                <button
                    type="button"
                    className={
                        styles.backButton
                    }
                    onClick={
                        handleBack
                    }
                >
                    <span
                        className={
                            styles.backArrow
                        }
                    >
                        ←
                    </span>

                    Back to posts
                </button>
            </div>

            {/* =================================================
                MAIN MEME
            ================================================= */}

            <section
                className={
                    styles.detail
                }
            >
                <div
                    className={
                        styles.imagePanel
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
                        styles.infoPanel
                    }
                >
                    <p
                        className={
                            styles.eyebrow
                        }
                    >
                        AI GENERATED MEME
                    </p>

                    <Link
                        href={
                            isMine
                                ? "/profile"
                                : `/user/${post.user_id}`
                        }
                        className={
                            styles.creator
                        }
                    >
                        <div
                            className={
                                styles.avatar
                            }
                        >
                            {profile.avatar_url ? (
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

                        <div>
                            <strong>
                                {
                                    displayName
                                }
                            </strong>

                            <small>
                                View profile
                            </small>
                        </div>
                    </Link>

                    <h1
                        className={
                            styles.caption
                        }
                    >
                        {
                            post.caption
                        }
                    </h1>

                    <div
                        className={
                            styles.metadata
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
                                score
                            }
                        </span>
                    </div>

                    {/* =================================================
                        VOTING
                    ================================================= */}

                    <div
                        className={[
                            styles.voteBar,

                            voteFlash ===
                            "funny"
                                ? styles.voteBarFunnyFlash
                                : "",

                            voteFlash ===
                            "notFunny"
                                ? styles.voteBarNotFunnyFlash
                                : "",
                        ]
                            .filter(
                                Boolean
                            )
                            .join(
                                " "
                            )}
                    >
                        <button
                            type="button"
                            aria-pressed={
                                userVote ===
                                1
                            }
                            className={[
                                styles.voteButton,

                                userVote ===
                                1
                                    ? styles.funnySelected
                                    : "",
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " "
                                )}
                            onPointerDown={(
                                event
                            ) => {
                                event.stopPropagation();
                            }}
                            onClick={(
                                event
                            ) =>
                                void handleVote(
                                    event,
                                    1
                                )
                            }
                        >
                            <span
                                className={
                                    styles.voteBackground
                                }
                            />

                            <span
                                className={
                                    styles.voteIcon
                                }
                            >
                                ↑
                            </span>

                            <span
                                className={
                                    styles.voteLabel
                                }
                            >
                                Funny
                            </span>

                            <strong
                                className={
                                    styles.voteCount
                                }
                            >
                                {
                                    funnyCount
                                }
                            </strong>
                        </button>

                        <button
                            type="button"
                            aria-pressed={
                                userVote ===
                                -1
                            }
                            className={[
                                styles.voteButton,

                                userVote ===
                                -1
                                    ? styles.notFunnySelected
                                    : "",
                            ]
                                .filter(
                                    Boolean
                                )
                                .join(
                                    " "
                                )}
                            onPointerDown={(
                                event
                            ) => {
                                event.stopPropagation();
                            }}
                            onClick={(
                                event
                            ) =>
                                void handleVote(
                                    event,
                                    -1
                                )
                            }
                        >
                            <span
                                className={
                                    styles.voteBackground
                                }
                            />

                            <span
                                className={
                                    styles.voteIcon
                                }
                            >
                                ↓
                            </span>

                            <span
                                className={
                                    styles.voteLabel
                                }
                            >
                                Not Funny
                            </span>

                            <strong
                                className={
                                    styles.voteCount
                                }
                            >
                                {
                                    notFunnyCount
                                }
                            </strong>
                        </button>
                    </div>

                    <div
                        className={
                            styles.voteStatus
                        }
                    >
                        {savingVote ? (
                            <span
                                className={
                                    styles.savingIndicator
                                }
                            >
                                <i />

                                Saving
                            </span>
                        ) : userVote ===
                        1 ? (
                            <span>
                                You voted Funny · Click again to undo
                            </span>
                        ) : userVote ===
                        -1 ? (
                            <span>
                                You voted Not Funny · Click again to undo
                            </span>
                        ) : (
                            <span>
                                Vote for your reaction
                            </span>
                        )}
                    </div>

                    {voteError && (
                        <p
                            className={
                                styles.error
                            }
                        >
                            {
                                voteError
                            }
                        </p>
                    )}

                    {isMine && (
                        <button
                            type="button"
                            className={
                                styles.deleteButton
                            }
                            disabled={
                                deleting
                            }
                            onClick={() =>
                                void deletePost()
                            }
                        >
                            {deleting
                                ? "Deleting..."
                                : "Delete post"}
                        </button>
                    )}
                </div>
            </section>

            {/* =================================================
                YOU MIGHT ALSO LIKE
            ================================================= */}

            {relatedPosts.length >
                0 && (
                    <section
                        className={
                            styles.relatedSection
                        }
                    >
                        <div
                            className={
                                styles.relatedHeader
                            }
                        >
                            <div>
                                <p>
                                    KEEP SCROLLING
                                </p>

                                <h2>
                                    You might also like
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        "/dashboard?view=explore"
                                    )
                                }
                            >
                                Explore all

                                <span>
                                →
                            </span>
                            </button>
                        </div>

                        <div
                            className={
                                styles.relatedGrid
                            }
                        >
                            {relatedPosts
                                .slice(
                                    0,
                                    3
                                )
                                .map(
                                    (
                                        related
                                    ) => (
                                        <Link
                                            key={
                                                related.id
                                            }
                                            href={`/meme/${related.id}`}
                                            className={
                                                styles.relatedCard
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.relatedImage
                                                }
                                            >
                                                <img
                                                    src={
                                                        related.image_url
                                                    }
                                                    alt=""
                                                />

                                                <div
                                                    className={
                                                        styles.relatedImageShade
                                                    }
                                                />

                                                <div
                                                    className={
                                                        styles.relatedVote
                                                    }
                                                >
                                                <span>
                                                    ↑
                                                </span>

                                                    {
                                                        related.funny
                                                    }
                                                </div>
                                            </div>

                                            <div
                                                className={
                                                    styles.relatedBody
                                                }
                                            >
                                                <h3>
                                                    {
                                                        related.caption
                                                    }
                                                </h3>

                                                <div
                                                    className={
                                                        styles.relatedMeta
                                                    }
                                                >
                                                <span>
                                                    Funny{" "}
                                                    {
                                                        related.funny
                                                    }
                                                </span>

                                                    <span>
                                                    Score{" "}
                                                        {
                                                            related.funny -
                                                            related.not_funny
                                                        }
                                                </span>
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                )}
                        </div>
                    </section>
                )}

            {/* =================================================
                LOGIN MODAL
            ================================================= */}

            {showAuthModal && (
                <div
                    className={
                        styles.authBackdrop
                    }
                    onClick={() =>
                        setShowAuthModal(
                            false
                        )
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
                            onClick={() =>
                                setShowAuthModal(
                                    false
                                )
                            }
                        >
                            ×
                        </button>

                        <div
                            className={
                                styles.authSpark
                            }
                        >
                            ↑
                        </div>

                        <p
                            className={
                                styles.authEyebrow
                            }
                        >
                            JOIN THE COMMUNITY
                        </p>

                        <h2>
                            Log in to vote.
                        </h2>

                        <p
                            className={
                                styles.authDescription
                            }
                        >
                            Votes are connected to accounts so community rankings stay fair.
                        </p>

                        <div
                            className={
                                styles.authActions
                            }
                        >
                            <button
                                type="button"
                                className={
                                    styles.authLogin
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
                                    styles.authSignup
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
                    </div>
                </div>
            )}
        </main>
    );
}