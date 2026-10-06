"use client";

import {
    ChangeEvent,
    useEffect,
    useMemo,
    useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Generation = {
    id: string;
    user_id: string;
    image_url: string;
    prompt: string;
    caption: string;
    created_at: string;
};

type Vote = {
    id: string;
    user_id: string;
    generation_id: string;
    vote: number;
};

type MemeDashboardProps = {
    userId: string;
    email: string;
};

export default function MemeDashboard({
                                          userId,
                                          email,
                                      }: MemeDashboardProps) {
    const supabase = useMemo(() => createClient(), []);

    const [imageFile, setImageFile] =
        useState<File | null>(null);

    const [previewUrl, setPreviewUrl] =
        useState<string | null>(null);

    const [prompt, setPrompt] = useState("");

    const [generations, setGenerations] =
        useState<Generation[]>([]);

    const [votes, setVotes] =
        useState<Vote[]>([]);

    const [loadingFeed, setLoadingFeed] =
        useState(true);

    const [generating, setGenerating] =
        useState(false);

    const [votingId, setVotingId] =
        useState<string | null>(null);

    const [message, setMessage] = useState("");

    useEffect(() => {
        void loadFeed();
    }, []);

    // --------------------------------------------------
    // LOAD MEMES + VOTES
    // --------------------------------------------------

    async function loadFeed() {
        setLoadingFeed(true);

        const {
            data: generationData,
            error: generationError,
        } = await supabase
            .from("generations")
            .select(
                "id, user_id, image_url, prompt, caption, created_at"
            )
            .order("created_at", {
                ascending: false,
            });

        if (generationError) {
            console.warn(generationError);

            setMessage(
                `Could not load memes: ${generationError.message}`
            );

            setLoadingFeed(false);
            return;
        }

        const {
            data: voteData,
            error: voteError,
        } = await supabase
            .from("votes")
            .select(
                "id, user_id, generation_id, vote"
            );

        if (voteError) {
            console.warn(voteError);

            setMessage(
                `Could not load votes: ${voteError.message}`
            );
        }

        setGenerations(generationData ?? []);
        setVotes(voteData ?? []);

        setLoadingFeed(false);
    }

    // --------------------------------------------------
    // IMAGE SELECTION
    // --------------------------------------------------

    function handleImageChange(
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
        ];

        if (!allowedTypes.includes(file.type)) {
            setMessage(
                "Please choose a PNG, JPEG, WEBP, or GIF."
            );

            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setMessage(
                "Image must be smaller than 10 MB."
            );

            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setImageFile(file);

        setPreviewUrl(
            URL.createObjectURL(file)
        );

        setMessage("");
    }

    function getFileExtension(file: File) {
        const extensionFromName =
            file.name
                .split(".")
                .pop()
                ?.toLowerCase();

        if (extensionFromName) {
            return extensionFromName;
        }

        if (file.type === "image/png") {
            return "png";
        }

        if (file.type === "image/jpeg") {
            return "jpg";
        }

        if (file.type === "image/webp") {
            return "webp";
        }

        if (file.type === "image/gif") {
            return "gif";
        }

        return "jpg";
    }

    // --------------------------------------------------
    // CREATE MEME
    // --------------------------------------------------

    async function generateMeme() {
        if (!imageFile) {
            setMessage(
                "Choose an image first."
            );

            return;
        }

        if (!prompt.trim()) {
            setMessage(
                "Enter a prompt first."
            );

            return;
        }

        setGenerating(true);

        setMessage(
            "Uploading image..."
        );

        try {
            // ----------------------------------------------
            // 1. UPLOAD IMAGE
            // ----------------------------------------------

            const extension =
                getFileExtension(imageFile);

            const filePath =
                `${userId}/${crypto.randomUUID()}.${extension}`;

            const {
                error: uploadError,
            } = await supabase.storage
                .from("meme-images")
                .upload(
                    filePath,
                    imageFile,
                    {
                        cacheControl: "3600",
                        upsert: false,
                        contentType:
                        imageFile.type,
                    }
                );

            if (uploadError) {
                throw new Error(
                    `Upload failed: ${uploadError.message}`
                );
            }

            const {
                data: { publicUrl },
            } = supabase.storage
                .from("meme-images")
                .getPublicUrl(filePath);

            // ----------------------------------------------
            // 2. GENERATE AI CAPTION
            // ----------------------------------------------

            setMessage(
                "AI is writing your caption..."
            );

            const aiResponse =
                await fetch(
                    "/api/generate-caption",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            imageUrl: publicUrl,
                            mimeType:
                            imageFile.type,
                            prompt:
                                prompt.trim(),
                        }),
                    }
                );

            const aiData =
                await aiResponse.json();

            if (!aiResponse.ok) {
                throw new Error(
                    aiData.error ??
                    "Could not generate caption."
                );
            }

            const caption =
                aiData.caption;

            // ----------------------------------------------
            // 3. SAVE GENERATION
            // ----------------------------------------------

            setMessage(
                "Saving meme..."
            );

            const {
                data: newGeneration,
                error: insertError,
            } = await supabase
                .from("generations")
                .insert({
                    user_id: userId,
                    image_url: publicUrl,
                    prompt:
                        prompt.trim(),
                    caption,
                })
                .select(
                    "id, user_id, image_url, prompt, caption, created_at"
                )
                .single();

            if (insertError) {
                throw new Error(
                    `Could not save meme: ${insertError.message}`
                );
            }

            // Put newest meme first
            setGenerations(
                (current) => [
                    newGeneration,
                    ...current,
                ]
            );

            // Clear form
            setPrompt("");
            setImageFile(null);

            if (previewUrl) {
                URL.revokeObjectURL(
                    previewUrl
                );
            }

            setPreviewUrl(null);

            setMessage(
                "Meme created!"
            );
        } catch (error) {
            // warn instead of error,
            // so Next.js does not show huge red overlay
            console.warn(error);

            if (error instanceof Error) {
                setMessage(
                    error.message
                );
            } else {
                setMessage(
                    "Something went wrong."
                );
            }
        } finally {
            setGenerating(false);
        }
    }

    // --------------------------------------------------
    // VOTING
    // --------------------------------------------------

    async function submitVote(
        generationId: string,
        voteValue: 1 | -1
    ) {
        const existingVote =
            votes.find(
                (vote) =>
                    vote.generation_id ===
                    generationId &&
                    vote.user_id ===
                    userId
            );

        setVotingId(
            generationId
        );

        setMessage("");

        // ----------------------------------------------
        // CASE 1:
        // Same button clicked again
        // -> REMOVE VOTE
        // ----------------------------------------------

        if (
            existingVote &&
            existingVote.vote ===
            voteValue
        ) {
            const {
                error,
            } = await supabase
                .from("votes")
                .delete()
                .eq(
                    "id",
                    existingVote.id
                );

            if (error) {
                console.warn(error);

                setMessage(
                    `Could not remove vote: ${error.message}`
                );

                setVotingId(null);

                return;
            }

            setVotes(
                (current) =>
                    current.filter(
                        (vote) =>
                            vote.id !==
                            existingVote.id
                    )
            );

            setMessage(
                "Vote removed."
            );

            setVotingId(null);

            return;
        }

        // ----------------------------------------------
        // CASE 2:
        // User voted already,
        // but chooses opposite vote
        // -> UPDATE
        // ----------------------------------------------

        if (existingVote) {
            const {
                data,
                error,
            } = await supabase
                .from("votes")
                .update({
                    vote: voteValue,
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
                console.warn(error);

                setMessage(
                    `Could not change vote: ${error.message}`
                );

                setVotingId(null);

                return;
            }

            setVotes(
                (current) =>
                    current.map(
                        (vote) =>
                            vote.id ===
                            existingVote.id
                                ? data
                                : vote
                    )
            );

            setMessage(
                voteValue === 1
                    ? "Changed vote to Funny."
                    : "Changed vote to Not Funny."
            );

            setVotingId(null);

            return;
        }

        // ----------------------------------------------
        // CASE 3:
        // No previous vote
        // -> INSERT
        // ----------------------------------------------

        const {
            data,
            error,
        } = await supabase
            .from("votes")
            .insert({
                user_id: userId,
                generation_id:
                generationId,
                vote: voteValue,
            })
            .select(
                "id, user_id, generation_id, vote"
            )
            .single();

        if (error) {
            console.warn(error);

            setMessage(
                `Vote failed: ${error.message}`
            );

            setVotingId(null);

            return;
        }

        setVotes(
            (current) => [
                ...current,
                data,
            ]
        );

        setMessage(
            voteValue === 1
                ? "You voted Funny."
                : "You voted Not Funny."
        );

        setVotingId(null);
    }

    // --------------------------------------------------
    // VOTE HELPERS
    // --------------------------------------------------

    function getFunnyCount(
        generationId: string
    ) {
        return votes.filter(
            (vote) =>
                vote.generation_id ===
                generationId &&
                vote.vote === 1
        ).length;
    }

    function getNotFunnyCount(
        generationId: string
    ) {
        return votes.filter(
            (vote) =>
                vote.generation_id ===
                generationId &&
                vote.vote === -1
        ).length;
    }

    function getUserVote(
        generationId: string
    ) {
        return votes.find(
            (vote) =>
                vote.generation_id ===
                generationId &&
                vote.user_id ===
                userId
        );
    }

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <main
            style={{
                minHeight: "100vh",

                background:
                    "radial-gradient(circle at top, #1b1b1b 0%, #090909 42%, #050505 100%)",

                color: "white",

                padding:
                    "48px 20px 80px",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "900px",
                    margin: "0 auto",
                }}
            >
                {/* HEADER */}

                <header
                    style={{
                        display: "flex",
                        justifyContent:
                            "space-between",
                        alignItems:
                            "center",
                        gap: "20px",
                        marginBottom:
                            "36px",
                    }}
                >
                    <div>
                        <div
                            style={{
                                color: "#888",
                                fontSize:
                                    "13px",
                                letterSpacing:
                                    "1.5px",
                                marginBottom:
                                    "8px",
                            }}
                        >
                            AI HUMOR LAB
                        </div>

                        <h1
                            style={{
                                fontSize:
                                    "42px",
                                margin: 0,
                                letterSpacing:
                                    "-1.5px",
                            }}
                        >
                            Meme Lab
                        </h1>

                        <p
                            style={{
                                color: "#999",
                                marginTop:
                                    "10px",
                            }}
                        >
                            Turn your photos
                            into AI-generated
                            jokes.
                        </p>
                    </div>

                    <div
                        style={{
                            textAlign:
                                "right",
                        }}
                    >
                        <div
                            style={{
                                color: "#888",
                                fontSize:
                                    "13px",
                                marginBottom:
                                    "8px",
                            }}
                        >
                            {email}
                        </div>

                        <Link
                            href="/profile"
                            style={{
                                color: "white",
                                textDecoration:
                                    "none",
                                fontWeight: 600,
                            }}
                        >
                            Profile →
                        </Link>
                    </div>
                </header>

                {/* CREATE MEME */}

                <section
                    style={{
                        background:
                            "linear-gradient(145deg, #202020, #151515)",

                        border:
                            "1px solid #343434",

                        borderRadius:
                            "24px",

                        padding:
                            "28px",

                        marginBottom:
                            "52px",

                        boxShadow:
                            "0 24px 60px rgba(0,0,0,.35)",
                    }}
                >
                    <h2
                        style={{
                            marginTop: 0,
                            fontSize:
                                "26px",
                        }}
                    >
                        Create a Meme
                    </h2>

                    <p
                        style={{
                            color: "#999",
                            marginBottom:
                                "24px",
                        }}
                    >
                        Upload a photo
                        and tell AI what
                        kind of joke you
                        want.
                    </p>

                    <label
                        style={{
                            display:
                                "block",

                            border:
                                "1px dashed #555",

                            borderRadius:
                                "18px",

                            padding:
                                "24px",

                            cursor:
                                "pointer",

                            textAlign:
                                "center",

                            background:
                                "#1b1b1b",

                            marginBottom:
                                "20px",
                        }}
                    >
                        {previewUrl ? (
                            <img
                                src={
                                    previewUrl
                                }
                                alt="Selected meme"
                                style={{
                                    width:
                                        "100%",

                                    maxHeight:
                                        "420px",

                                    objectFit:
                                        "contain",

                                    borderRadius:
                                        "14px",
                                }}
                            />
                        ) : (
                            <>
                                <div
                                    style={{
                                        fontSize:
                                            "34px",

                                        marginBottom:
                                            "10px",
                                    }}
                                >
                                    +
                                </div>

                                <strong>
                                    Choose an
                                    image
                                </strong>

                                <div
                                    style={{
                                        color:
                                            "#777",

                                        fontSize:
                                            "13px",

                                        marginTop:
                                            "8px",
                                    }}
                                >
                                    PNG, JPEG,
                                    WEBP or GIF ·
                                    max 10 MB
                                </div>
                            </>
                        )}

                        <input
                            type="file"

                            accept="image/png,image/jpeg,image/webp,image/gif"

                            onChange={
                                handleImageChange
                            }

                            style={{
                                display:
                                    "none",
                            }}
                        />
                    </label>

                    <label
                        style={{
                            display:
                                "block",

                            color:
                                "#aaa",

                            fontSize:
                                "13px",

                            marginBottom:
                                "8px",
                        }}
                    >
                        PROMPT
                    </label>

                    <textarea
                        value={prompt}

                        onChange={(
                            event
                        ) =>
                            setPrompt(
                                event.target
                                    .value
                            )
                        }

                        placeholder="Example: Make this feel like a chronically-online Columbia student meme..."

                        rows={4}

                        style={{
                            width:
                                "100%",

                            boxSizing:
                                "border-box",

                            resize:
                                "vertical",

                            background:
                                "#1b1b1b",

                            border:
                                "1px solid #363636",

                            borderRadius:
                                "14px",

                            color:
                                "white",

                            padding:
                                "16px",

                            fontSize:
                                "15px",

                            outline:
                                "none",

                            marginBottom:
                                "16px",
                        }}
                    />

                    <button
                        onClick={
                            generateMeme
                        }

                        disabled={
                            generating
                        }

                        style={{
                            width:
                                "100%",

                            border:
                                "none",

                            borderRadius:
                                "14px",

                            padding:
                                "16px",

                            fontSize:
                                "16px",

                            fontWeight:
                                700,

                            cursor:
                                generating
                                    ? "not-allowed"
                                    : "pointer",

                            background:
                                generating
                                    ? "#555"
                                    : "white",

                            color:
                                generating
                                    ? "#aaa"
                                    : "#111",
                        }}
                    >
                        {generating
                            ? "Generating..."
                            : "Generate AI Caption"}
                    </button>

                    {message && (
                        <p
                            style={{
                                textAlign:
                                    "center",

                                color:
                                    "#aaa",

                                marginBottom:
                                    0,

                                marginTop:
                                    "16px",
                            }}
                        >
                            {message}
                        </p>
                    )}
                </section>

                {/* COMMUNITY */}

                <section>
                    <div
                        style={{
                            display:
                                "flex",

                            justifyContent:
                                "space-between",

                            alignItems:
                                "center",

                            marginBottom:
                                "20px",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize:
                                        "12px",

                                    letterSpacing:
                                        "1.5px",

                                    color:
                                        "#777",

                                    marginBottom:
                                        "6px",
                                }}
                            >
                                COMMUNITY
                            </div>

                            <h2
                                style={{
                                    margin: 0,

                                    fontSize:
                                        "30px",
                                }}
                            >
                                Meme Feed
                            </h2>
                        </div>

                        <button
                            onClick={
                                loadFeed
                            }

                            style={{
                                border:
                                    "1px solid #333",

                                borderRadius:
                                    "12px",

                                background:
                                    "#151515",

                                color:
                                    "white",

                                padding:
                                    "10px 16px",

                                cursor:
                                    "pointer",
                            }}
                        >
                            Refresh
                        </button>
                    </div>

                    {loadingFeed && (
                        <p
                            style={{
                                color:
                                    "#888",
                            }}
                        >
                            Loading memes...
                        </p>
                    )}

                    {!loadingFeed &&
                        generations.length ===
                        0 && (
                            <div
                                style={{
                                    border:
                                        "1px solid #292929",

                                    borderRadius:
                                        "20px",

                                    padding:
                                        "40px",

                                    color:
                                        "#777",

                                    textAlign:
                                        "center",
                                }}
                            >
                                No memes yet.
                                Be the first
                                to create one.
                            </div>
                        )}

                    <div
                        style={{
                            display:
                                "grid",

                            gap:
                                "28px",
                        }}
                    >
                        {generations.map(
                            (
                                generation
                            ) => {
                                const funnyCount =
                                    getFunnyCount(
                                        generation.id
                                    );

                                const notFunnyCount =
                                    getNotFunnyCount(
                                        generation.id
                                    );

                                const userVote =
                                    getUserVote(
                                        generation.id
                                    );

                                return (
                                    <article
                                        key={
                                            generation.id
                                        }

                                        style={{
                                            overflow:
                                                "hidden",

                                            borderRadius:
                                                "22px",

                                            border:
                                                "1px solid #303030",

                                            background:
                                                "#151515",
                                        }}
                                    >
                                        <img
                                            src={
                                                generation.image_url
                                            }

                                            alt="Meme"

                                            style={{
                                                width:
                                                    "100%",

                                                maxHeight:
                                                    "620px",

                                                objectFit:
                                                    "contain",

                                                display:
                                                    "block",

                                                background:
                                                    "#0b0b0b",
                                            }}
                                        />

                                        <div
                                            style={{
                                                padding:
                                                    "24px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize:
                                                        "24px",

                                                    lineHeight:
                                                        1.35,

                                                    fontWeight:
                                                        700,

                                                    marginBottom:
                                                        "18px",
                                                }}
                                            >
                                                {
                                                    generation.caption
                                                }
                                            </div>

                                            <div
                                                style={{
                                                    color:
                                                        "#777",

                                                    fontSize:
                                                        "13px",

                                                    marginBottom:
                                                        "20px",
                                                }}
                                            >
                                                Prompt:{" "}
                                                {
                                                    generation.prompt
                                                }
                                            </div>

                                            <div
                                                style={{
                                                    display:
                                                        "grid",

                                                    gridTemplateColumns:
                                                        "1fr 1fr",

                                                    gap:
                                                        "12px",
                                                }}
                                            >
                                                {/* FUNNY */}

                                                <button
                                                    disabled={
                                                        votingId ===
                                                        generation.id
                                                    }

                                                    onClick={() =>
                                                        submitVote(
                                                            generation.id,
                                                            1
                                                        )
                                                    }

                                                    style={{
                                                        border:
                                                            userVote?.vote ===
                                                            1
                                                                ? "1px solid white"
                                                                : "1px solid #383838",

                                                        background:
                                                            userVote?.vote ===
                                                            1
                                                                ? "white"
                                                                : "#202020",

                                                        color:
                                                            userVote?.vote ===
                                                            1
                                                                ? "#111"
                                                                : "white",

                                                        borderRadius:
                                                            "14px",

                                                        padding:
                                                            "14px",

                                                        fontSize:
                                                            "15px",

                                                        fontWeight:
                                                            600,

                                                        cursor:
                                                            votingId ===
                                                            generation.id
                                                                ? "wait"
                                                                : "pointer",
                                                    }}
                                                >
                                                    👍 Funny{" "}
                                                    {
                                                        funnyCount
                                                    }
                                                </button>

                                                {/* NOT FUNNY */}

                                                <button
                                                    disabled={
                                                        votingId ===
                                                        generation.id
                                                    }

                                                    onClick={() =>
                                                        submitVote(
                                                            generation.id,
                                                            -1
                                                        )
                                                    }

                                                    style={{
                                                        border:
                                                            userVote?.vote ===
                                                            -1
                                                                ? "1px solid white"
                                                                : "1px solid #383838",

                                                        background:
                                                            userVote?.vote ===
                                                            -1
                                                                ? "white"
                                                                : "#202020",

                                                        color:
                                                            userVote?.vote ===
                                                            -1
                                                                ? "#111"
                                                                : "white",

                                                        borderRadius:
                                                            "14px",

                                                        padding:
                                                            "14px",

                                                        fontSize:
                                                            "15px",

                                                        fontWeight:
                                                            600,

                                                        cursor:
                                                            votingId ===
                                                            generation.id
                                                                ? "wait"
                                                                : "pointer",
                                                    }}
                                                >
                                                    👎 Not Funny{" "}
                                                    {
                                                        notFunnyCount
                                                    }
                                                </button>
                                            </div>

                                            {userVote && (
                                                <div
                                                    style={{
                                                        color:
                                                            "#777",

                                                        textAlign:
                                                            "center",

                                                        fontSize:
                                                            "12px",

                                                        marginTop:
                                                            "12px",
                                                    }}
                                                >
                                                    Click your
                                                    selected vote
                                                    again to remove
                                                    it, or choose
                                                    the other option
                                                    to change your
                                                    vote.
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            }
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}