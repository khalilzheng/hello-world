"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { createClient } from "@/utils/supabase/client";
import SiteNav from "@/app/components/SiteNav";
import styles from "./MemeDashboard.module.css";

type Generation = {
    id: string;
    user_id: string;
    created_at: string;
    image_url: string;
    prompt: string;
    caption: string;
};

type UserVote = {
    id: string;
    user_id: string;
    generation_id: string;
    vote: number;
};

type VoteCount = {
    funny: number;
    notFunny: number;
    score: number;
};

type VoteCountRow = {
    generation_id: string;
    funny: number | string;
    not_funny: number | string;
    score: number | string;
};

type PublicProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
};

type FeedMode = "new" | "top";

type VoteEffect = {
    generationId: string;
    value: 1 | -1;
    key: number;
};

type Props = {
    userId: string | null;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);

const SUGGESTIONS = [
    {
        label: "Finals week",
        prompt:
            "Write one short, logically consistent meme caption about a Columbia student surviving finals week. Use the image naturally. Maximum 12 words.",
    },
    {
        label: "Butler at 2 AM",
        prompt:
            "Write one short, logically consistent meme caption about studying at Butler Library at 2 AM. Use the image naturally. Maximum 12 words.",
    },
    {
        label: "CourseWorks",
        prompt:
            "Write one short, logically consistent meme caption about opening CourseWorks and seeing too many assignments due tonight. Use the image naturally. Maximum 12 words.",
    },
    {
        label: "The 1 train",
        prompt:
            "Write one short, logically consistent meme caption about waiting for the 1 train when class starts in ten minutes. Use the image naturally. Maximum 12 words.",
    },
    {
        label: "Group project",
        prompt:
            "Write one short, logically consistent meme caption about a Columbia group project where one person does all the work. Use the image naturally. Maximum 12 words.",
    },
];

function pickRandom<T>(items: T[]): T | null {
    if (items.length === 0) {
        return null;
    }

    return items[Math.floor(Math.random() * items.length)];
}

function getStoragePath(imageUrl: string) {
    const marker =
        "/storage/v1/object/public/meme-images/";

    const index = imageUrl.indexOf(marker);

    if (index === -1) {
        return null;
    }

    return decodeURIComponent(
        imageUrl.slice(index + marker.length)
    );
}

function getDisplayName(
    profile: PublicProfile | undefined
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
    profile: PublicProfile | undefined
) {
    if (!profile) {
        return "M";
    }

    const first =
        profile.first_name?.trim().charAt(0) ?? "";

    const last =
        profile.last_name?.trim().charAt(0) ?? "";

    return (
        `${first}${last}`.toUpperCase() || "M"
    );
}

function formatFileSize(bytes: number) {
    return `${(
        bytes /
        1024 /
        1024
    ).toFixed(1)} MB`;
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

export default function MemeDashboard({
                                          userId,
                                      }: Props) {
    const router = useRouter();

    const supabase = useMemo(
        () => createClient(),
        []
    );

    const fileInputRef =
        useRef<HTMLInputElement | null>(null);

    const promptInputRef =
        useRef<HTMLTextAreaElement | null>(null);

    const [
        generations,
        setGenerations,
    ] = useState<Generation[]>([]);

    const [
        userVotes,
        setUserVotes,
    ] = useState<UserVote[]>([]);

    const [
        voteCounts,
        setVoteCounts,
    ] = useState<Record<string, VoteCount>>({});

    const [
        voteCountsLoaded,
        setVoteCountsLoaded,
    ] = useState(false);

    const [
        publicProfiles,
        setPublicProfiles,
    ] = useState<Record<string, PublicProfile>>(
        {}
    );

    const [
        heroGenerationId,
        setHeroGenerationId,
    ] = useState<string | null>(null);

    const [
        imageFile,
        setImageFile,
    ] = useState<File | null>(null);

    const [
        previewUrl,
        setPreviewUrl,
    ] = useState("");

    const [
        prompt,
        setPrompt,
    ] = useState("");

    const [
        loadingFeed,
        setLoadingFeed,
    ] = useState(true);

    const [
        generating,
        setGenerating,
    ] = useState(false);

    const [
        votingId,
        setVotingId,
    ] = useState<string | null>(null);

    const [
        deletingId,
        setDeletingId,
    ] = useState<string | null>(null);

    const [
        voteEffect,
        setVoteEffect,
    ] = useState<VoteEffect | null>(null);

    const [
        feedMode,
        setFeedMode,
    ] = useState<FeedMode>("new");

    const [
        message,
        setMessage,
    ] = useState("");

    const [
        showLoginModal,
        setShowLoginModal,
    ] = useState(false);

    const [
        composerAttention,
        setComposerAttention,
    ] = useState(false);

    const loggedIn = Boolean(userId);

    function highlightComposer() {
        setComposerAttention(false);

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                setComposerAttention(true);
            });
        });

        window.setTimeout(() => {
            setComposerAttention(false);
        }, 1250);
    }

    function focusComposer() {
        promptInputRef.current?.focus({
            preventScroll: true,
        });

        highlightComposer();
    }

    function triggerVoteEffect(
        generationId: string,
        value: 1 | -1
    ) {
        const key = Date.now();

        setVoteEffect({
            generationId,
            value,
            key,
        });

        window.setTimeout(() => {
            setVoteEffect((current) => {
                if (current?.key === key) {
                    return null;
                }

                return current;
            });
        }, 650);
    }

    const loadVoteCounts = useCallback(
        async (showInitialLoading = false) => {
            if (showInitialLoading) {
                setVoteCountsLoaded(false);
            }

            const { data, error } =
                await supabase.rpc(
                    "get_public_vote_counts"
                );

            if (error) {
                throw error;
            }

            const result: Record<
                string,
                VoteCount
            > = {};

            for (const row of
                (data ?? []) as VoteCountRow[]) {
                result[row.generation_id] = {
                    funny: Number(row.funny),
                    notFunny: Number(row.not_funny),
                    score: Number(row.score),
                };
            }

            setVoteCounts(result);

            if (showInitialLoading) {
                setVoteCountsLoaded(true);
            }
        },
        [supabase]
    );

    const loadPublicProfiles = useCallback(
        async () => {
            const { data, error } =
                await supabase.rpc(
                    "get_public_profiles"
                );

            if (error) {
                throw error;
            }

            const map: Record<
                string,
                PublicProfile
            > = {};

            for (const profile of
                (data ?? []) as PublicProfile[]) {
                map[profile.id] = profile;
            }

            setPublicProfiles(map);
        },
        [supabase]
    );

    const loadFeed = useCallback(
        async () => {
            try {
                setLoadingFeed(true);

                const { data, error } =
                    await supabase
                        .from("generations")
                        .select(
                            "id, user_id, created_at, image_url, prompt, caption"
                        )
                        .order("created_at", {
                            ascending: false,
                        });

                if (error) {
                    throw error;
                }

                setGenerations(
                    (data ?? []) as Generation[]
                );

                await Promise.all([
                    loadVoteCounts(true),
                    loadPublicProfiles(),
                ]);

                if (userId) {
                    const {
                        data: voteData,
                        error: voteError,
                    } = await supabase
                        .from("votes")
                        .select(
                            "id, user_id, generation_id, vote"
                        )
                        .eq("user_id", userId);

                    if (voteError) {
                        throw voteError;
                    }

                    setUserVotes(
                        (voteData ?? []) as UserVote[]
                    );
                } else {
                    setUserVotes([]);
                }
            } catch (error) {
                console.warn(error);

                setMessage(
                    "Could not load the community feed."
                );
            } finally {
                setLoadingFeed(false);
            }
        },
        [
            supabase,
            userId,
            loadVoteCounts,
            loadPublicProfiles,
        ]
    );

    useEffect(() => {
        void loadFeed();
    }, [loadFeed]);

    useEffect(() => {
        const params =
            new URLSearchParams(
                window.location.search
            );

        const hash =
            window.location.hash;

        if (params.get("feed") === "top") {
            setFeedMode("top");
        }

        if (hash === "#community") {
            window.setTimeout(() => {
                document
                    .getElementById("community")
                    ?.scrollIntoView({
                        behavior: "auto",
                        block: "start",
                    });
            }, 120);

            return;
        }

        if (hash === "#create") {
            window.scrollTo({
                top: 0,
                behavior: "auto",
            });

            window.setTimeout(() => {
                focusComposer();
            }, 180);
        }
    }, []);

    useEffect(() => {
        if (!imageFile) {
            setPreviewUrl("");
            return;
        }

        const objectUrl =
            URL.createObjectURL(imageFile);

        setPreviewUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [imageFile]);

    const heroCandidates =
        useMemo(() => {
            if (
                !voteCountsLoaded ||
                generations.length === 0
            ) {
                return [];
            }

            const maxFunny = Math.max(
                ...generations.map(
                    (generation) =>
                        voteCounts[generation.id]?.funny ?? 0
                )
            );

            return generations.filter(
                (generation) =>
                    (voteCounts[generation.id]?.funny ??
                        0) === maxFunny
            );
        }, [
            generations,
            voteCounts,
            voteCountsLoaded,
        ]);

    useEffect(() => {
        if (
            !voteCountsLoaded ||
            heroCandidates.length === 0
        ) {
            return;
        }

        setHeroGenerationId((currentId) => {
            const currentStillTop = Boolean(
                currentId &&
                heroCandidates.some(
                    (candidate) =>
                        candidate.id === currentId
                )
            );

            if (currentStillTop) {
                return currentId;
            }

            return (
                pickRandom(heroCandidates)?.id ??
                null
            );
        });
    }, [
        heroCandidates,
        voteCountsLoaded,
    ]);

    const heroGeneration =
        useMemo(() => {
            if (
                !voteCountsLoaded ||
                !heroGenerationId
            ) {
                return null;
            }

            return (
                generations.find(
                    (generation) =>
                        generation.id ===
                        heroGenerationId
                ) ?? null
            );
        }, [
            generations,
            heroGenerationId,
            voteCountsLoaded,
        ]);

    const heroImage =
        heroGeneration?.image_url ?? "";

    function goHome() {
        promptInputRef.current?.blur();
        setComposerAttention(false);

        window.history.replaceState(
            {},
            "",
            "/dashboard"
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function goCreate() {
        window.history.replaceState(
            {},
            "",
            "/dashboard#create"
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });

        window.setTimeout(() => {
            focusComposer();
        }, 420);
    }

    function goExplore() {
        promptInputRef.current?.blur();

        setComposerAttention(false);
        setFeedMode("new");

        window.history.replaceState(
            {},
            "",
            "/dashboard#community"
        );

        document
            .getElementById("community")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
    }

    function requestLogin() {
        setShowLoginModal(true);
    }

    function openFilePicker() {
        if (!loggedIn) {
            requestLogin();
            return;
        }

        fileInputRef.current?.click();
    }

    function clearReference() {
        setImageFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function handleImageChange(
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0] ?? null;

        if (!file) {
            return;
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            setMessage(
                "Please upload a PNG, JPG, WEBP, or GIF."
            );

            event.target.value = "";
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setMessage(
                "That image is larger than 10 MB. Please choose a smaller file."
            );

            event.target.value = "";
            return;
        }

        setMessage("");
        setImageFile(file);
    }

    function getExtension(file: File) {
        const extension =
            file.name
                .split(".")
                .pop()
                ?.toLowerCase();

        if (extension) {
            return extension;
        }

        if (file.type === "image/png") {
            return "png";
        }

        if (file.type === "image/webp") {
            return "webp";
        }

        if (file.type === "image/gif") {
            return "gif";
        }

        return "jpg";
    }

    async function generateMeme() {
        if (!userId) {
            requestLogin();
            return;
        }

        if (!imageFile) {
            setMessage("Add an image first.");
            highlightComposer();
            return;
        }

        if (!prompt.trim()) {
            setMessage(
                "Tell AI what kind of joke you want."
            );

            focusComposer();
            return;
        }

        try {
            setGenerating(true);

            setMessage(
                "Generating your meme..."
            );

            const extension =
                getExtension(imageFile);

            const objectPath =
                `${userId}/${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } =
                await supabase.storage
                    .from("meme-images")
                    .upload(
                        objectPath,
                        imageFile,
                        {
                            contentType:
                            imageFile.type,
                            upsert: false,
                        }
                    );

            if (uploadError) {
                throw uploadError;
            }

            const { data: urlData } =
                supabase.storage
                    .from("meme-images")
                    .getPublicUrl(objectPath);

            const imageUrl =
                urlData.publicUrl;

            const response = await fetch(
                "/api/generate-caption",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        imageUrl,
                        mimeType:
                        imageFile.type,
                        prompt:
                            prompt.trim(),
                    }),
                }
            );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ??
                    "AI generation failed."
                );
            }

            const caption = String(
                result.caption ?? ""
            ).trim();

            if (!caption) {
                throw new Error(
                    "AI returned an empty caption."
                );
            }

            const {
                data: inserted,
                error: insertError,
            } = await supabase
                .from("generations")
                .insert({
                    user_id: userId,
                    image_url: imageUrl,
                    prompt: prompt.trim(),
                    caption,
                })
                .select(
                    "id, user_id, created_at, image_url, prompt, caption"
                )
                .single();

            if (insertError) {
                throw insertError;
            }

            const newPost =
                inserted as Generation;

            clearReference();
            setPrompt("");
            setMessage("");

            /*
             * NEW FLOW:
             *
             * Do not scroll into the community.
             * Take the user directly to the
             * freshly-generated meme.
             *
             * created=1 tells the detail page
             * to play the one-time reveal.
             */
            router.push(
                `/meme/${newPost.id}?created=1`
            );
        } catch (error) {
            console.warn(error);

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Something went wrong."
            );
        } finally {
            setGenerating(false);
        }
    }

    function getVoteCount(
        generationId: string
    ): VoteCount {
        return (
            voteCounts[generationId] ?? {
                funny: 0,
                notFunny: 0,
                score: 0,
            }
        );
    }

    function currentUserVote(
        generationId: string
    ) {
        return userVotes.find(
            (vote) =>
                vote.generation_id ===
                generationId &&
                vote.user_id === userId
        );
    }

    async function submitVote(
        generationId: string,
        value: 1 | -1
    ) {
        if (!userId) {
            requestLogin();
            return;
        }

        try {
            setVotingId(generationId);

            const existingVote =
                currentUserVote(
                    generationId
                );

            if (
                existingVote &&
                existingVote.vote === value
            ) {
                const { error } =
                    await supabase
                        .from("votes")
                        .delete()
                        .eq(
                            "id",
                            existingVote.id
                        );

                if (error) {
                    throw error;
                }

                setUserVotes((current) =>
                    current.filter(
                        (vote) =>
                            vote.id !==
                            existingVote.id
                    )
                );

                await loadVoteCounts();

                return;
            }

            if (existingVote) {
                const { data, error } =
                    await supabase
                        .from("votes")
                        .update({
                            vote: value,
                        })
                        .eq(
                            "id",
                            existingVote.id
                        )
                        .select(
                            "id, user_id, generation_id, vote"
                        )
                        .single();

                if (error) {
                    throw error;
                }

                setUserVotes((current) =>
                    current.map((vote) =>
                        vote.id ===
                        existingVote.id
                            ? (data as UserVote)
                            : vote
                    )
                );

                await loadVoteCounts();

                triggerVoteEffect(
                    generationId,
                    value
                );

                return;
            }

            const { data, error } =
                await supabase
                    .from("votes")
                    .insert({
                        user_id: userId,
                        generation_id:
                        generationId,
                        vote: value,
                    })
                    .select(
                        "id, user_id, generation_id, vote"
                    )
                    .single();

            if (error) {
                throw error;
            }

            setUserVotes((current) => [
                ...current,
                data as UserVote,
            ]);

            await loadVoteCounts();

            triggerVoteEffect(
                generationId,
                value
            );
        } catch (error) {
            console.warn(error);

            setMessage(
                "Could not save your vote."
            );
        } finally {
            setVotingId(null);
        }
    }

    async function deletePost(
        generation: Generation
    ) {
        if (
            !userId ||
            generation.user_id !== userId
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
            setDeletingId(
                generation.id
            );

            const storagePath =
                getStoragePath(
                    generation.image_url
                );

            if (storagePath) {
                const {
                    error: storageError,
                } =
                    await supabase.storage
                        .from("meme-images")
                        .remove([
                            storagePath,
                        ]);

                if (storageError) {
                    console.warn(
                        storageError
                    );
                }
            }

            const {
                error: deleteError,
            } = await supabase
                .from("generations")
                .delete()
                .eq("id", generation.id)
                .eq("user_id", userId);

            if (deleteError) {
                throw deleteError;
            }

            setGenerations((current) =>
                current.filter(
                    (item) =>
                        item.id !==
                        generation.id
                )
            );

            setUserVotes((current) =>
                current.filter(
                    (vote) =>
                        vote.generation_id !==
                        generation.id
                )
            );

            setVoteCounts((current) => {
                const next = {
                    ...current,
                };

                delete next[
                    generation.id
                    ];

                return next;
            });

            setMessage(
                "Meme deleted."
            );
        } catch (error) {
            console.warn(error);

            setMessage(
                "Could not delete this meme."
            );
        } finally {
            setDeletingId(null);
        }
    }

    const sortedGenerations =
        useMemo(() => {
            const copy = [
                ...generations,
            ];

            if (feedMode === "top") {
                return copy.sort(
                    (a, b) => {
                        const aFunny =
                            voteCounts[a.id]
                                ?.funny ?? 0;

                        const bFunny =
                            voteCounts[b.id]
                                ?.funny ?? 0;

                        if (
                            bFunny !== aFunny
                        ) {
                            return (
                                bFunny - aFunny
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
            }

            return copy.sort(
                (a, b) =>
                    new Date(
                        b.created_at
                    ).getTime() -
                    new Date(
                        a.created_at
                    ).getTime()
            );
        }, [
            generations,
            voteCounts,
            feedMode,
        ]);

    const examples =
        generations.slice(0, 8);

    return (
        <main className={styles.page}>
            <section
                id="top"
                className={styles.hero}
            >
                <div
                    className={`${styles.heroBackground} ${
                        heroImage
                            ? styles.heroBackgroundVisible
                            : ""
                    }`}
                    style={
                        heroImage
                            ? {
                                backgroundImage: `
                    linear-gradient(
                      180deg,
                      rgba(0,0,0,.28) 0%,
                      rgba(0,0,0,.38) 42%,
                      rgba(0,0,0,.57) 76%,
                      rgba(0,0,0,.96) 100%
                    ),
                    url("${heroImage}")
                  `,
                            }
                            : undefined
                    }
                />

                <SiteNav
                    userId={userId}
                    onHomeClick={goHome}
                    onCreateClick={goCreate}
                    onExploreClick={goExplore}
                />

                <div
                    className={
                        styles.heroContent
                    }
                >
                    <p className={styles.eyebrow}>
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
                        id="create"
                        className={[
                            styles.composer,
                            composerAttention
                                ? styles.composerAttention
                                : "",
                        ].join(" ")}
                    >
                        {previewUrl && (
                            <div
                                className={
                                    styles.referencePreview
                                }
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={previewUrl}
                                    alt="Selected image"
                                />

                                <div>
                                    <strong>
                                        Image added
                                    </strong>

                                    <span>
                    {imageFile?.name}
                  </span>
                                </div>

                                <button
                                    type="button"
                                    aria-label="Remove image"
                                    onClick={
                                        clearReference
                                    }
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        <textarea
                            ref={promptInputRef}
                            className={
                                styles.promptInput
                            }
                            value={prompt}
                            rows={3}
                            placeholder="Describe the Columbia moment you want to turn into a meme..."
                            onChange={(event) =>
                                setPrompt(
                                    event.target.value
                                )
                            }
                        />

                        <div
                            className={
                                styles.composerFooter
                            }
                        >
                            <div
                                className={
                                    styles.composerToolArea
                                }
                            >
                                <div
                                    className={
                                        styles.composerTools
                                    }
                                >
                                    <button
                                        type="button"
                                        className={
                                            styles.referenceButton
                                        }
                                        onClick={
                                            openFilePicker
                                        }
                                    >
                                        ＋ Add image
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            styles.referenceButton
                                        }
                                        onClick={() => {
                                            const item =
                                                SUGGESTIONS[
                                                    Math.floor(
                                                        Math.random() *
                                                        SUGGESTIONS.length
                                                    )
                                                    ];

                                            setPrompt(
                                                item.prompt
                                            );

                                            window.setTimeout(
                                                () => {
                                                    promptInputRef.current?.focus(
                                                        {
                                                            preventScroll:
                                                                true,
                                                        }
                                                    );
                                                },
                                                20
                                            );
                                        }}
                                    >
                                        ↻ Suggest prompt
                                    </button>
                                </div>

                                <span
                                    className={
                                        styles.uploadHint
                                    }
                                >
                  {imageFile
                      ? `${imageFile.name} · ${formatFileSize(
                          imageFile.size
                      )}`
                      : "PNG, JPG, WEBP or GIF · Max 10 MB"}
                </span>
                            </div>

                            <button
                                type="button"
                                className={
                                    styles.generateButton
                                }
                                disabled={generating}
                                onClick={() =>
                                    void generateMeme()
                                }
                            >
                                ✦{" "}
                                {generating
                                    ? "Generating..."
                                    : "Generate"}
                            </button>
                        </div>

                        <input
                            hidden
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={
                                handleImageChange
                            }
                        />

                        {message && (
                            <div
                                className={
                                    styles.statusMessage
                                }
                            >
                                {message}
                            </div>
                        )}
                    </div>

                    <div
                        className={
                            styles.suggestions
                        }
                    >
                        {SUGGESTIONS.map(
                            (item) => (
                                <button
                                    type="button"
                                    key={item.label}
                                    onClick={() => {
                                        setPrompt(
                                            item.prompt
                                        );

                                        promptInputRef.current?.focus(
                                            {
                                                preventScroll:
                                                    true,
                                            }
                                        );
                                    }}
                                >
                                    {item.label}
                                </button>
                            )
                        )}
                    </div>
                </div>

                <div
                    className={
                        styles.heroExamples
                    }
                >
                    <div
                        className={
                            styles.examplesHeader
                        }
                    >
                        <strong>
                            Examples
                        </strong>

                        <span>
              Community creations
            </span>
                    </div>

                    <div
                        className={
                            styles.examplesRow
                        }
                    >
                        {examples.map(
                            (generation) => (
                                <Link
                                    href={`/meme/${generation.id}`}
                                    key={generation.id}
                                    className={
                                        styles.exampleCard
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

                                    <span>
                    {
                        generation.caption
                    }
                  </span>
                                </Link>
                            )
                        )}
                    </div>
                </div>
            </section>

            <section
                id="community"
                className={
                    styles.community
                }
            >
                <div
                    className={
                        styles.communityIntro
                    }
                >
                    <p>EXPLORE</p>

                    <h2>
                        Campus humor,
                        generated by AI.
                    </h2>

                    <span>
            Browse community
            creations, meet the
            people behind them, and
            discover what Columbia
            finds funny.
          </span>
                </div>

                <div
                    className={
                        styles.communityHeader
                    }
                >
                    <div>
                        <p>COMMUNITY</p>

                        <h3>
                            Made on campus
                        </h3>
                    </div>

                    <div
                        className={
                            styles.feedControls
                        }
                    >
                        <button
                            type="button"
                            className={
                                feedMode === "new"
                                    ? styles.activeControl
                                    : ""
                            }
                            onClick={() => {
                                setFeedMode("new");

                                window.history.replaceState(
                                    {},
                                    "",
                                    "/dashboard#community"
                                );
                            }}
                        >
                            New
                        </button>

                        <button
                            type="button"
                            className={
                                feedMode === "top"
                                    ? styles.activeControl
                                    : ""
                            }
                            onClick={() => {
                                setFeedMode("top");

                                window.history.replaceState(
                                    {},
                                    "",
                                    "/dashboard?feed=top#community"
                                );
                            }}
                        >
                            Top
                        </button>
                    </div>
                </div>

                {!loggedIn && (
                    <div
                        className={
                            styles.guestNotice
                        }
                    >
                        <div>
                            <strong>
                                Browse freely.
                            </strong>

                            <span>
                Log in when you want
                to create or vote.
              </span>
                        </div>

                        <Link href="/signup">
                            Sign up for free
                        </Link>
                    </div>
                )}

                {loadingFeed ? (
                    <div
                        className={
                            styles.loadingState
                        }
                    >
                        Loading community...
                    </div>
                ) : (
                    <div
                        className={
                            styles.memeGrid
                        }
                    >
                        {sortedGenerations.map(
                            (generation) => {
                                const counts =
                                    getVoteCount(
                                        generation.id
                                    );

                                const userVote =
                                    currentUserVote(
                                        generation.id
                                    );

                                const profile =
                                    publicProfiles[
                                        generation.user_id
                                        ];

                                const isOwner =
                                    Boolean(
                                        userId &&
                                        userId ===
                                        generation.user_id
                                    );

                                const funnyEffect =
                                    voteEffect?.generationId ===
                                    generation.id &&
                                    voteEffect.value === 1;

                                const notFunnyEffect =
                                    voteEffect?.generationId ===
                                    generation.id &&
                                    voteEffect.value === -1;

                                return (
                                    <article
                                        id={`meme-${generation.id}`}
                                        key={
                                            generation.id
                                        }
                                        className={
                                            styles.memeCard
                                        }
                                    >
                                        <Link
                                            href={`/meme/${generation.id}`}
                                            className={
                                                styles.imageLink
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.memeImageWrap
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
                                        </Link>

                                        <div
                                            className={
                                                styles.memeBody
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.authorRow
                                                }
                                            >
                                                <Link
                                                    href={`/user/${generation.user_id}`}
                                                    className={
                                                        styles.authorLink
                                                    }
                                                >
                                                    {profile?.avatar_url ? (
                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                        <img
                                                            className={
                                                                styles.authorAvatar
                                                            }
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
                                                                styles.authorAvatarFallback
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

                                                {isOwner && (
                                                    <span
                                                        className={
                                                            styles.youBadge
                                                        }
                                                    >
                            You
                          </span>
                                                )}
                                            </div>

                                            <Link
                                                href={`/meme/${generation.id}`}
                                                className={
                                                    styles.captionLink
                                                }
                                            >
                                                <h3>
                                                    {
                                                        generation.caption
                                                    }
                                                </h3>
                                            </Link>

                                            <p
                                                className={
                                                    styles.promptText
                                                }
                                            >
                                                Prompt:{" "}
                                                {
                                                    generation.prompt
                                                }
                                            </p>

                                            <div
                                                className={
                                                    styles.meta
                                                }
                                            >
                        <span>
                          {new Date(
                              generation.created_at
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

                                                <span>
                          Score{" "}
                                                    {
                                                        counts.score
                                                    }
                        </span>
                                            </div>

                                            <div
                                                className={
                                                    styles.voteDock
                                                }
                                            >
                                                <button
                                                    type="button"
                                                    disabled={
                                                        votingId ===
                                                        generation.id
                                                    }
                                                    className={[
                                                        styles.voteButton,
                                                        styles.funnyVote,
                                                        userVote?.vote ===
                                                        1
                                                            ? styles.funnySelected
                                                            : "",
                                                        funnyEffect
                                                            ? styles.voteEffect
                                                            : "",
                                                    ].join(" ")}
                                                    onClick={() =>
                                                        void submitVote(
                                                            generation.id,
                                                            1
                                                        )
                                                    }
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

                                                    <span
                                                        className={
                                                            styles.voteCount
                                                        }
                                                    >
                            {
                                counts.funny
                            }
                          </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={
                                                        votingId ===
                                                        generation.id
                                                    }
                                                    className={[
                                                        styles.voteButton,
                                                        styles.notFunnyVote,
                                                        userVote?.vote ===
                                                        -1
                                                            ? styles.notFunnySelected
                                                            : "",
                                                        notFunnyEffect
                                                            ? styles.voteEffect
                                                            : "",
                                                    ].join(" ")}
                                                    onClick={() =>
                                                        void submitVote(
                                                            generation.id,
                                                            -1
                                                        )
                                                    }
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

                                                    <span
                                                        className={
                                                            styles.voteCount
                                                        }
                                                    >
                            {
                                counts.notFunny
                            }
                          </span>
                                                </button>
                                            </div>

                                            {isOwner && (
                                                <button
                                                    type="button"
                                                    className={
                                                        styles.deleteButton
                                                    }
                                                    disabled={
                                                        deletingId ===
                                                        generation.id
                                                    }
                                                    onClick={() =>
                                                        void deletePost(
                                                            generation
                                                        )
                                                    }
                                                >
                                                    {deletingId ===
                                                    generation.id
                                                        ? "Deleting..."
                                                        : "Delete post"}
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                );
                            }
                        )}
                    </div>
                )}
            </section>

            {showLoginModal && (
                <div
                    className={
                        styles.modalBackdrop
                    }
                    onMouseDown={() =>
                        setShowLoginModal(false)
                    }
                >
                    <div
                        className={
                            styles.loginModal
                        }
                        onMouseDown={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <button
                            type="button"
                            className={
                                styles.modalClose
                            }
                            onClick={() =>
                                setShowLoginModal(false)
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
                            Create AI memes and
                            vote on the best
                            campus humor.
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
        </main>
    );
}