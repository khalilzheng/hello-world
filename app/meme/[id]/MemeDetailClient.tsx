"use client";

import Link from "next/link";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

import SiteNav from "@/app/components/SiteNav";

import styles from "./MemeDetail.module.css";


type Generation = {
    id: string;
    user_id: string;
    created_at: string;
    image_url: string;
    prompt: string;
    caption: string;
};


type PublicProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
};


type UserVote = {
    id: string;
    user_id: string;
    generation_id: string;
    vote: number;
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


type VoteEffect = {
    value: 1 | -1;
    key: number;
};


type Props = {
    memeId: string;
    userId: string | null;
    initiallyCreated: boolean;
};


function getDisplayName(
    profile: PublicProfile | null
) {
    if (!profile) {
        return "Meme Lab user";
    }

    const first =
        profile.first_name?.trim() ?? "";

    const last =
        profile.last_name?.trim() ?? "";

    return (
        `${first} ${last}`.trim() ||
        "Meme Lab user"
    );
}


function getInitials(
    profile: PublicProfile | null
) {
    if (!profile) {
        return "M";
    }

    const first =
        profile.first_name
            ?.trim()
            .charAt(0) ?? "";

    const last =
        profile.last_name
            ?.trim()
            .charAt(0) ?? "";

    return (
        `${first}${last}`.toUpperCase() ||
        "M"
    );
}


function getStoragePath(
    imageUrl: string
) {
    const marker =
        "/storage/v1/object/public/meme-images/";

    const index =
        imageUrl.indexOf(marker);

    if (index === -1) {
        return null;
    }

    return decodeURIComponent(
        imageUrl.slice(
            index + marker.length
        )
    );
}


function VoteParticles() {
    return (
        <span
            className={styles.voteParticles}
            aria-hidden="true"
        >
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
    );
}


export default function MemeDetailClient({
                                             memeId,
                                             userId,
                                             initiallyCreated,
                                         }: Props) {
    const router = useRouter();

    const supabase = useMemo(
        () => createClient(),
        []
    );


    const [
        generation,
        setGeneration,
    ] =
        useState<Generation | null>(
            null
        );


    const [
        profile,
        setProfile,
    ] =
        useState<PublicProfile | null>(
            null
        );


    const [
        recommendations,
        setRecommendations,
    ] =
        useState<Generation[]>([]);


    const [
        voteCount,
        setVoteCount,
    ] =
        useState<VoteCount>({
            funny: 0,
            notFunny: 0,
            score: 0,
        });


    const [
        userVote,
        setUserVote,
    ] =
        useState<UserVote | null>(
            null
        );


    const [
        loading,
        setLoading,
    ] =
        useState(true);


    const [
        voting,
        setVoting,
    ] =
        useState(false);


    const [
        deleting,
        setDeleting,
    ] =
        useState(false);


    const [
        errorMessage,
        setErrorMessage,
    ] =
        useState("");


    const [
        showLoginModal,
        setShowLoginModal,
    ] =
        useState(false);


    const [
        revealVisible,
        setRevealVisible,
    ] =
        useState(
            initiallyCreated
        );


    const [
        revealLeaving,
        setRevealLeaving,
    ] =
        useState(false);


    const [
        voteEffect,
        setVoteEffect,
    ] =
        useState<VoteEffect | null>(
            null
        );


    const isOwner =
        Boolean(
            userId &&
            generation &&
            userId ===
            generation.user_id
        );


    /* =========================================================
       VOTE EFFECT
       ========================================================= */

    function triggerVoteEffect(
        value: 1 | -1
    ) {
        const key = Date.now();

        setVoteEffect({
            value,
            key,
        });

        window.setTimeout(
            () => {
                setVoteEffect(
                    (current) => {
                        if (
                            current?.key ===
                            key
                        ) {
                            return null;
                        }

                        return current;
                    }
                );
            },
            680
        );
    }


    /* =========================================================
       LOAD VOTE COUNT
       ========================================================= */

    const loadVoteCount =
        useCallback(
            async () => {
                const {
                    data,
                    error,
                } =
                    await supabase.rpc(
                        "get_public_vote_counts"
                    );

                if (error) {
                    throw error;
                }

                const row = (
                    (data ??
                        []) as VoteCountRow[]
                ).find(
                    (item) =>
                        item.generation_id ===
                        memeId
                );

                if (!row) {
                    setVoteCount({
                        funny: 0,
                        notFunny: 0,
                        score: 0,
                    });

                    return;
                }

                setVoteCount({
                    funny: Number(
                        row.funny
                    ),

                    notFunny: Number(
                        row.not_funny
                    ),

                    score: Number(
                        row.score
                    ),
                });
            },
            [supabase, memeId]
        );


    /* =========================================================
       LOAD PAGE
       ========================================================= */

    const loadPage =
        useCallback(
            async () => {
                try {
                    setLoading(true);

                    const {
                        data: memeData,
                        error: memeError,
                    } =
                        await supabase
                            .from(
                                "generations"
                            )
                            .select(
                                "id, user_id, created_at, image_url, prompt, caption"
                            )
                            .eq(
                                "id",
                                memeId
                            )
                            .single();

                    if (memeError) {
                        throw memeError;
                    }

                    const meme =
                        memeData as Generation;

                    setGeneration(meme);


                    const [
                        profilesResult,
                        recommendationsResult,
                    ] =
                        await Promise.all([
                            supabase.rpc(
                                "get_public_profiles"
                            ),

                            supabase
                                .from(
                                    "generations"
                                )
                                .select(
                                    "id, user_id, created_at, image_url, prompt, caption"
                                )
                                .neq(
                                    "id",
                                    memeId
                                )
                                .order(
                                    "created_at",
                                    {
                                        ascending:
                                            false,
                                    }
                                )
                                .limit(12),
                        ]);


                    if (
                        profilesResult.error
                    ) {
                        throw profilesResult.error;
                    }


                    if (
                        recommendationsResult.error
                    ) {
                        throw recommendationsResult.error;
                    }


                    const allProfiles =
                        (profilesResult.data ??
                            []) as PublicProfile[];


                    const memeProfile =
                        allProfiles.find(
                            (item) =>
                                item.id ===
                                meme.user_id
                        ) ?? null;


                    setProfile(
                        memeProfile
                    );


                    const allRecommendations =
                        (recommendationsResult.data ??
                            []) as Generation[];


                    const shuffled = [
                        ...allRecommendations,
                    ].sort(
                        () =>
                            Math.random() -
                            0.5
                    );


                    setRecommendations(
                        shuffled.slice(
                            0,
                            3
                        )
                    );


                    await loadVoteCount();


                    if (userId) {
                        const {
                            data: voteData,
                            error: voteError,
                        } =
                            await supabase
                                .from(
                                    "votes"
                                )
                                .select(
                                    "id, user_id, generation_id, vote"
                                )
                                .eq(
                                    "user_id",
                                    userId
                                )
                                .eq(
                                    "generation_id",
                                    memeId
                                )
                                .maybeSingle();


                        if (voteError) {
                            throw voteError;
                        }


                        setUserVote(
                            voteData
                                ? (voteData as UserVote)
                                : null
                        );
                    } else {
                        setUserVote(null);
                    }
                } catch (error) {
                    console.warn(
                        error
                    );

                    setErrorMessage(
                        "This meme could not be loaded."
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                supabase,
                memeId,
                userId,
                loadVoteCount,
            ]
        );


    useEffect(() => {
        void loadPage();
    }, [loadPage]);


    /* =========================================================
       JUST GENERATED REVEAL
       ========================================================= */

    useEffect(() => {
        if (
            !initiallyCreated ||
            !generation
        ) {
            return;
        }

        setRevealVisible(true);


        const leavingTimer =
            window.setTimeout(
                () => {
                    setRevealLeaving(
                        true
                    );
                },
                2500
            );


        const hideTimer =
            window.setTimeout(
                () => {
                    setRevealVisible(
                        false
                    );

                    setRevealLeaving(
                        false
                    );

                    window.history.replaceState(
                        {},
                        "",
                        `/meme/${memeId}`
                    );
                },
                3150
            );


        return () => {
            window.clearTimeout(
                leavingTimer
            );

            window.clearTimeout(
                hideTimer
            );
        };
    }, [
        initiallyCreated,
        generation,
        memeId,
    ]);


    function closeReveal() {
        setRevealLeaving(true);

        window.setTimeout(
            () => {
                setRevealVisible(
                    false
                );

                setRevealLeaving(
                    false
                );

                window.history.replaceState(
                    {},
                    "",
                    `/meme/${memeId}`
                );
            },
            460
        );
    }


    /* =========================================================
       VOTING
       ========================================================= */

    async function submitVote(
        value: 1 | -1
    ) {
        if (!userId) {
            setShowLoginModal(
                true
            );

            return;
        }


        if (!generation) {
            return;
        }


        try {
            setVoting(true);


            /*
             * CLICKING THE SAME
             * SELECTED VOTE AGAIN
             * REMOVES IT.
             */

            if (
                userVote &&
                userVote.vote ===
                value
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
                            "id",
                            userVote.id
                        );


                if (error) {
                    throw error;
                }


                setUserVote(null);

                await loadVoteCount();

                return;
            }


            /*
             * CHANGE EXISTING VOTE
             */

            if (userVote) {
                const {
                    data,
                    error,
                } =
                    await supabase
                        .from(
                            "votes"
                        )
                        .update({
                            vote: value,
                        })
                        .eq(
                            "id",
                            userVote.id
                        )
                        .select(
                            "id, user_id, generation_id, vote"
                        )
                        .single();


                if (error) {
                    throw error;
                }


                setUserVote(
                    data as UserVote
                );


                await loadVoteCount();


                triggerVoteEffect(
                    value
                );

                return;
            }


            /*
             * CREATE NEW VOTE
             */

            const {
                data,
                error,
            } =
                await supabase
                    .from(
                        "votes"
                    )
                    .insert({
                        user_id:
                        userId,

                        generation_id:
                        generation.id,

                        vote: value,
                    })
                    .select(
                        "id, user_id, generation_id, vote"
                    )
                    .single();


            if (error) {
                throw error;
            }


            setUserVote(
                data as UserVote
            );


            await loadVoteCount();


            triggerVoteEffect(
                value
            );
        } catch (error) {
            console.warn(
                error
            );

            setErrorMessage(
                "Could not save your vote."
            );
        } finally {
            setVoting(false);
        }
    }


    /* =========================================================
       DELETE POST
       ========================================================= */

    async function deletePost() {
        if (
            !generation ||
            !userId ||
            generation.user_id !==
            userId
        ) {
            return;
        }


        const confirmed =
            window.confirm(
                "Delete this meme? This cannot be undone."
            );


        if (!confirmed) {
            return;
        }


        try {
            setDeleting(true);


            const storagePath =
                getStoragePath(
                    generation.image_url
                );


            if (storagePath) {
                const {
                    error: storageError,
                } =
                    await supabase.storage
                        .from(
                            "meme-images"
                        )
                        .remove([
                            storagePath,
                        ]);


                if (
                    storageError
                ) {
                    console.warn(
                        storageError
                    );
                }
            }


            const {
                error: deleteError,
            } =
                await supabase
                    .from(
                        "generations"
                    )
                    .delete()
                    .eq(
                        "id",
                        generation.id
                    )
                    .eq(
                        "user_id",
                        userId
                    );


            if (deleteError) {
                throw deleteError;
            }


            router.push(
                "/dashboard#community"
            );

            router.refresh();
        } catch (error) {
            console.warn(
                error
            );

            setErrorMessage(
                "Could not delete this meme."
            );
        } finally {
            setDeleting(false);
        }
    }


    /* =========================================================
       LOADING
       ========================================================= */

    if (
        loading &&
        !generation
    ) {
        return (
            <main
                className={
                    styles.loadingPage
                }
            >
                <SiteNav
                    userId={userId}
                />

                <div
                    className={
                        styles.loadingGlow
                    }
                />

                <div
                    className={
                        styles.loadingContent
                    }
                >
          <span>
            ✦
          </span>

                    <p>
                        Loading creation
                    </p>
                </div>
            </main>
        );
    }


    /* =========================================================
       NOT FOUND
       ========================================================= */

    if (!generation) {
        return (
            <main
                className={
                    styles.errorPage
                }
            >
                <SiteNav
                    userId={userId}
                />

                <div>
                    <p>404</p>

                    <h1>
                        Meme not found.
                    </h1>

                    <Link href="/dashboard">
                        Back to Meme Lab
                    </Link>
                </div>
            </main>
        );
    }


    const funnyEffect =
        voteEffect?.value === 1;


    const notFunnyEffect =
        voteEffect?.value === -1;


    /* =========================================================
       PAGE
       ========================================================= */

    return (
        <main
            className={styles.page}
        >
            <SiteNav
                userId={userId}
            />


            {/* =====================================================
          MAIN DETAIL
          ===================================================== */}

            <section
                className={
                    styles.detailSection
                }
            >
                <div
                    className={
                        styles.detailInner
                    }
                >
                    <div
                        className={
                            styles.imageColumn
                        }
                    >
                        <div
                            className={
                                styles.imageFrame
                            }
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}

                            <img
                                src={
                                    generation.image_url
                                }
                                alt={
                                    generation.caption
                                }
                            />
                        </div>
                    </div>


                    <div
                        className={
                            styles.infoColumn
                        }
                    >
                        <p
                            className={
                                styles.detailEyebrow
                            }
                        >
                            AI GENERATED MEME
                        </p>


                        <Link
                            href={`/user/${generation.user_id}`}
                            className={
                                styles.author
                            }
                        >
                            {profile?.avatar_url ? (
                                /* eslint-disable-next-line @next/next/no-img-element */

                                <img
                                    src={
                                        profile.avatar_url
                                    }
                                    alt={getDisplayName(
                                        profile
                                    )}
                                />
                            ) : (
                                <span
                                    className={
                                        styles.avatarFallback
                                    }
                                >
                  {getInitials(
                      profile
                  )}
                </span>
                            )}


                            <div>
                                <strong>
                                    {getDisplayName(
                                        profile
                                    )}
                                </strong>

                                <span>
                  View profile
                </span>
                            </div>
                        </Link>


                        <h1>
                            {
                                generation.caption
                            }
                        </h1>


                        <div
                            className={
                                styles.promptCard
                            }
                        >
              <span>
                PROMPT
              </span>

                            <p>
                                {
                                    generation.prompt
                                }
                            </p>
                        </div>


                        <div
                            className={
                                styles.detailMeta
                            }
                        >
              <span>
                {new Date(
                    generation.created_at
                ).toLocaleDateString(
                    undefined,
                    {
                        month:
                            "long",

                        day:
                            "numeric",

                        year:
                            "numeric",
                    }
                )}
              </span>

                            <span>
                Score{" "}
                                {
                                    voteCount.score
                                }
              </span>
                        </div>


                        {/* =================================================
                VOTE DOCK
                SAME EFFECT AS DASHBOARD
                ================================================= */}

                        <div
                            className={
                                styles.voteDock
                            }
                        >
                            <button
                                type="button"
                                disabled={voting}
                                onClick={() =>
                                    void submitVote(
                                        1
                                    )
                                }
                                className={[
                                    styles.voteButton,
                                    styles.funnyButton,

                                    userVote?.vote ===
                                    1
                                        ? styles.funnySelected
                                        : "",

                                    funnyEffect
                                        ? styles.voteEffect
                                        : "",
                                ].join(" ")}
                            >
                                <VoteParticles />

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
                                        voteCount.funny
                                    }
                                </strong>
                            </button>


                            <button
                                type="button"
                                disabled={voting}
                                onClick={() =>
                                    void submitVote(
                                        -1
                                    )
                                }
                                className={[
                                    styles.voteButton,
                                    styles.notFunnyButton,

                                    userVote?.vote ===
                                    -1
                                        ? styles.notFunnySelected
                                        : "",

                                    notFunnyEffect
                                        ? styles.voteEffect
                                        : "",
                                ].join(" ")}
                            >
                                <VoteParticles />

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
                                        voteCount.notFunny
                                    }
                                </strong>
                            </button>
                        </div>


                        {isOwner && (
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


                        {errorMessage && (
                            <p
                                className={
                                    styles.errorMessage
                                }
                            >
                                {
                                    errorMessage
                                }
                            </p>
                        )}
                    </div>
                </div>
            </section>


            {/* =====================================================
          YOU MIGHT ALSO LIKE
          ===================================================== */}

            <section
                className={
                    styles.relatedSection
                }
            >
                <div
                    className={
                        styles.relatedInner
                    }
                >
                    <p
                        className={
                            styles.relatedEyebrow
                        }
                    >
                        DISCOVER MORE
                    </p>


                    <div
                        className={
                            styles.relatedHeading
                        }
                    >
                        <h2>
                            You might also like
                        </h2>

                        <Link
                            href="/dashboard#community"
                        >
                            Explore all →
                        </Link>
                    </div>


                    <div
                        className={
                            styles.relatedGrid
                        }
                    >
                        {recommendations.map(
                            (item) => (
                                <Link
                                    key={
                                        item.id
                                    }
                                    href={`/meme/${item.id}`}
                                    className={
                                        styles.relatedCard
                                    }
                                >
                                    <div
                                        className={
                                            styles.relatedImage
                                        }
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}

                                        <img
                                            src={
                                                item.image_url
                                            }
                                            alt={
                                                item.caption
                                            }
                                        />
                                    </div>


                                    <div
                                        className={
                                            styles.relatedText
                                        }
                                    >
                                        <p>
                                            {
                                                item.caption
                                            }
                                        </p>

                                        <span>
                      View meme →
                    </span>
                                    </div>
                                </Link>
                            )
                        )}
                    </div>
                </div>
            </section>


            {/* =====================================================
          LOGIN MODAL
          ===================================================== */}

            {showLoginModal && (
                <div
                    className={
                        styles.modalBackdrop
                    }
                    onMouseDown={() =>
                        setShowLoginModal(
                            false
                        )
                    }
                >
                    <div
                        className={
                            styles.loginModal
                        }
                        onMouseDown={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <button
                            type="button"
                            className={
                                styles.modalClose
                            }
                            onClick={() =>
                                setShowLoginModal(
                                    false
                                )
                            }
                        >
                            ×
                        </button>


                        <div
                            className={
                                styles.modalMark
                            }
                        >
                            M
                        </div>


                        <h2>
                            Join the joke.
                        </h2>


                        <p>
                            Log in to vote on
                            campus memes.
                        </p>


                        <Link
                            href="/signup"
                            className={
                                styles.modalPrimary
                            }
                        >
                            Sign up for free
                        </Link>


                        <Link
                            href="/login"
                            className={
                                styles.modalSecondary
                            }
                        >
                            Already have an
                            account? Log in
                        </Link>
                    </div>
                </div>
            )}


            {/* =====================================================
          JUST GENERATED REVEAL
          ===================================================== */}

            {revealVisible && (
                <div
                    className={[
                        styles.revealOverlay,

                        revealLeaving
                            ? styles.revealLeaving
                            : "",
                    ].join(" ")}
                >
                    <div
                        className={
                            styles.revealAura
                        }
                    />


                    <div
                        className={
                            styles.revealOrbOne
                        }
                    />


                    <div
                        className={
                            styles.revealOrbTwo
                        }
                    />


                    <div
                        className={
                            styles.revealParticles
                        }
                        aria-hidden="true"
                    >
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                    </div>


                    <div
                        className={
                            styles.revealContent
                        }
                    >
                        <div
                            className={
                                styles.revealSpark
                            }
                        >
                            ✦
                        </div>


                        <p
                            className={
                                styles.revealLabel
                            }
                        >
                            JUST GENERATED
                        </p>


                        <h2>
                            Your meme is live.
                        </h2>


                        <div
                            className={
                                styles.revealImageShell
                            }
                        >
                            <div
                                className={
                                    styles.revealImageGlow
                                }
                            />


                            {/* eslint-disable-next-line @next/next/no-img-element */}

                            <img
                                src={
                                    generation.image_url
                                }
                                alt={
                                    generation.caption
                                }
                            />
                        </div>


                        <p
                            className={
                                styles.revealCaption
                            }
                        >
                            “
                            {
                                generation.caption
                            }
                            ”
                        </p>


                        <div
                            className={
                                styles.revealMeta
                            }
                        >
              <span>
                AI generated
              </span>

                            <span>
                •
              </span>

                            <span>
                Ready to vote
              </span>
                        </div>


                        <button
                            type="button"
                            className={
                                styles.revealButton
                            }
                            onClick={
                                closeReveal
                            }
                        >
                            View your post

                            <span>
                →
              </span>
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}