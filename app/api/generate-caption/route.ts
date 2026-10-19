import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type GenerateRequestBody = {
    imageUrl?: unknown;
    mimeType?: unknown;
    prompt?: unknown;
    guestTrial?: unknown;
};

type GenerateResult = {
    caption: string;
    model: string;
};

/*
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const ALLOWED_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);

const MAX_PROMPT_LENGTH = 1200;

/*
 * We try the stronger model first.
 *
 * If it is overloaded, we immediately move on instead of
 * making the user wait through several long retries.
 */
const MODEL_CHAIN = [
    {
        name: "gemini-3.8-flash",
        attempts: 1,
    },
    {
        name: "gemini-3.5-flash-lite",
        attempts: 2,
    },
] as const;

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function cleanString(
    value: unknown
): string {
    if (
        typeof value !==
        "string"
    ) {
        return "";
    }

    return value.trim();
}

function isGuestTrial(
    value: unknown
): boolean {
    return value === true;
}

function normalizeMimeType(
    value: string
): string {
    return value
        .split(";")[0]
        .trim()
        .toLowerCase();
}

function inferMimeTypeFromUrl(
    url: string
): string | null {
    const cleanUrl =
        url
            .split("?")[0]
            .toLowerCase();

    if (
        cleanUrl.endsWith(
            ".png"
        )
    ) {
        return "image/png";
    }

    if (
        cleanUrl.endsWith(
            ".jpg"
        ) ||
        cleanUrl.endsWith(
            ".jpeg"
        )
    ) {
        return "image/jpeg";
    }

    if (
        cleanUrl.endsWith(
            ".webp"
        )
    ) {
        return "image/webp";
    }

    if (
        cleanUrl.endsWith(
            ".gif"
        )
    ) {
        return "image/gif";
    }

    return null;
}

function isRetryableError(
    error: unknown
): boolean {
    const message =
        error instanceof Error
            ? error.message
            : String(error);

    const upper =
        message.toUpperCase();

    return (
        upper.includes("503") ||
        upper.includes("429") ||
        upper.includes(
            "UNAVAILABLE"
        ) ||
        upper.includes(
            "RESOURCE_EXHAUSTED"
        ) ||
        upper.includes(
            "HIGH DEMAND"
        ) ||
        upper.includes(
            "OVERLOADED"
        )
    );
}

function sleep(
    milliseconds: number
) {
    return new Promise<void>(
        (resolve) => {
            setTimeout(
                resolve,
                milliseconds
            );
        }
    );
}

/*
 * Gemini occasionally puts quotation marks around its answer.
 * Remove only surrounding quotation marks so the stored caption
 * stays clean.
 */
function cleanCaption(
    value: string
): string {
    let caption =
        value.trim();

    if (
        caption.startsWith(
            "```"
        )
    ) {
        caption =
            caption
                .replace(
                    /^```(?:text)?/i,
                    ""
                )
                .replace(
                    /```$/,
                    ""
                )
                .trim();
    }

    /*
     * Remove common prefixes Gemini may add.
     */
    caption =
        caption.replace(
            /^(caption|meme caption)\s*:\s*/i,
            ""
        );

    /*
     * Remove one pair of matching surrounding quotes.
     */
    if (
        (caption.startsWith(
                '"'
            ) &&
            caption.endsWith(
                '"'
            )) ||
        (caption.startsWith(
                "“"
            ) &&
            caption.endsWith(
                "”"
            ))
    ) {
        caption =
            caption
                .slice(1, -1)
                .trim();
    }

    return caption;
}

/*
 * =========================================================
 * IMAGE SAFETY
 *
 * Do not let this endpoint fetch arbitrary internet URLs.
 * It may only fetch images from our meme-images bucket.
 * =========================================================
 */

function getAllowedImagePrefix():
    | string
    | null {
    const supabaseUrl =
        process.env
            .NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
        return null;
    }

    return (
        `${supabaseUrl}`.replace(
            /\/$/,
            ""
        ) +
        "/storage/v1/object/public/meme-images/"
    );
}

function isAllowedImageUrl(
    imageUrl: string
): boolean {
    const prefix =
        getAllowedImagePrefix();

    if (!prefix) {
        return false;
    }

    return imageUrl.startsWith(
        prefix
    );
}

/*
 * =========================================================
 * DOWNLOAD IMAGE
 * =========================================================
 */

async function downloadImage(
    imageUrl: string,
    requestedMimeType: string
): Promise<{
    base64: string;
    mimeType: string;
}> {
    const response =
        await fetch(
            imageUrl,
            {
                cache:
                    "no-store",
            }
        );

    if (!response.ok) {
        throw new Error(
            `Could not load image (${response.status}).`
        );
    }

    const responseMime =
        normalizeMimeType(
            response.headers.get(
                "content-type"
            ) ?? ""
        );

    const requested =
        normalizeMimeType(
            requestedMimeType
        );

    const inferred =
        inferMimeTypeFromUrl(
            imageUrl
        );

    /*
     * Prefer actual HTTP response MIME type.
     * Then use frontend MIME.
     * Then infer from file extension.
     */
    const mimeType =
        ALLOWED_MIME_TYPES.has(
            responseMime
        )
            ? responseMime
            : ALLOWED_MIME_TYPES.has(
                requested
            )
                ? requested
                : inferred &&
                ALLOWED_MIME_TYPES.has(
                    inferred
                )
                    ? inferred
                    : "";

    if (!mimeType) {
        throw new Error(
            "Unsupported image type."
        );
    }

    const arrayBuffer =
        await response.arrayBuffer();

    if (
        arrayBuffer.byteLength ===
        0
    ) {
        throw new Error(
            "The image is empty."
        );
    }

    /*
     * Extra server-side safety.
     *
     * Storage already limits uploads, but this also prevents
     * an unexpectedly large object from being forwarded to AI.
     */
    const maxBytes =
        12 *
        1024 *
        1024;

    if (
        arrayBuffer.byteLength >
        maxBytes
    ) {
        throw new Error(
            "Image is too large."
        );
    }

    const base64 =
        Buffer.from(
            arrayBuffer
        ).toString(
            "base64"
        );

    return {
        base64,
        mimeType,
    };
}

/*
 * =========================================================
 * BUILD PROMPT
 * =========================================================
 */

function buildFinalPrompt(
    userPrompt: string,
    guestTrial: boolean
): string {
    /*
     * IMPORTANT:
     *
     * Guest trial no longer checks that the prompt is one of
     * several exact hard-coded strings.
     *
     * That was what caused:
     *
     * "Invalid trial prompt."
     *
     * We safely wrap ANY reasonable guest direction instead.
     */

    if (guestTrial) {
        return `
You are creating a preview meme caption for Meme Lab.

Look carefully at the supplied image.

Write exactly ONE short, funny, internet-friendly meme caption.

The joke should feel natural for a Columbia University / NYC / college-life audience when relevant.

User direction:
${userPrompt}

Rules:
- Return ONLY the caption.
- Do not explain your reasoning.
- Do not add "Caption:".
- Do not use hashtags.
- Keep it concise.
- Prefer 12 words or fewer when possible.
- The joke should make sense with the image.
- Do not simply repeat the user's direction.
`.trim();
    }

    return `
You are creating a meme caption for Meme Lab.

Look carefully at the supplied image.

Write exactly ONE short, witty, internet-friendly meme caption.

The audience is college students, especially people familiar with Columbia University, NYC, campus life, finals, CourseWorks, Butler Library, group projects, commuting, and chronically-online humor.

User request:
${userPrompt}

Rules:
- Return ONLY the caption.
- Do not explain your reasoning.
- Do not add "Caption:".
- Do not use hashtags.
- Keep the caption concise.
- Prefer 12 words or fewer when possible.
- Use the image naturally.
- Make the joke logically consistent with both the image and the user's request.
`.trim();
}

/*
 * =========================================================
 * CALL ONE GEMINI MODEL
 * =========================================================
 */

async function callGeminiModel(
    ai: GoogleGenAI,
    modelName: string,
    imageBase64: string,
    mimeType: string,
    finalPrompt: string
): Promise<string> {
    console.log(
        `Calling ${modelName}...`
    );

    const response =
        await ai.models.generateContent(
            {
                model:
                modelName,

                contents: [
                    {
                        role:
                            "user",

                        parts: [
                            {
                                inlineData:
                                    {
                                        mimeType,

                                        data:
                                        imageBase64,
                                    },
                            },
                            {
                                text:
                                finalPrompt,
                            },
                        ],
                    },
                ],
            }
        );

    /*
     * @google/genai exposes generated text through response.text.
     */
    const rawText =
        response.text ?? "";

    const caption =
        cleanCaption(
            rawText
        );

    if (!caption) {
        throw new Error(
            `${modelName} returned an empty caption.`
        );
    }

    return caption;
}

/*
 * =========================================================
 * MODEL FALLBACK
 * =========================================================
 */

async function generateWithFallback(
    ai: GoogleGenAI,
    imageBase64: string,
    mimeType: string,
    finalPrompt: string
): Promise<GenerateResult> {
    let lastError: unknown =
        null;

    for (
        const modelConfig
        of MODEL_CHAIN
        ) {
        for (
            let attempt = 1;
            attempt <=
            modelConfig.attempts;
            attempt++
        ) {
            try {
                console.log(
                    `Calling ${modelConfig.name}, attempt ${attempt}...`
                );

                const caption =
                    await callGeminiModel(
                        ai,
                        modelConfig.name,
                        imageBase64,
                        mimeType,
                        finalPrompt
                    );

                console.log(
                    `Caption generated using ${modelConfig.name}:`,
                    caption
                );

                return {
                    caption,
                    model:
                    modelConfig.name,
                };
            } catch (error) {
                lastError =
                    error;

                console.warn(
                    `${modelConfig.name} attempt ${attempt} failed:`,
                    error
                );

                /*
                 * If this is NOT a temporary overload/rate-limit error,
                 * do not keep retrying the same model.
                 *
                 * We can still move to the fallback model.
                 */
                if (
                    !isRetryableError(
                        error
                    )
                ) {
                    break;
                }

                /*
                 * Do not waste several seconds retrying the primary.
                 * Primary only has one attempt.
                 *
                 * For the fallback, one short retry is reasonable.
                 */
                if (
                    attempt <
                    modelConfig.attempts
                ) {
                    await sleep(
                        650
                    );
                }
            }
        }
    }

    throw (
        lastError ??
        new Error(
            "No AI model was available."
        )
    );
}

/*
 * =========================================================
 * POST
 * =========================================================
 */

export async function POST(
    request: Request
) {
    try {
        /*
         * ---------------------------------------------
         * API KEY
         * ---------------------------------------------
         */

        const apiKey =
            process.env
                .GEMINI_API_KEY;

        if (!apiKey) {
            console.error(
                "GEMINI_API_KEY is missing."
            );

            return NextResponse.json(
                {
                    error:
                        "AI service is not configured.",
                },
                {
                    status:
                        500,
                }
            );
        }

        /*
         * ---------------------------------------------
         * REQUEST BODY
         * ---------------------------------------------
         */

        let body:
            GenerateRequestBody;

        try {
            body =
                (await request.json()) as GenerateRequestBody;
        } catch {
            return NextResponse.json(
                {
                    error:
                        "Invalid request.",
                },
                {
                    status:
                        400,
                }
            );
        }

        const imageUrl =
            cleanString(
                body.imageUrl
            );

        const mimeTypeFromClient =
            cleanString(
                body.mimeType
            );

        const userPrompt =
            cleanString(
                body.prompt
            );

        const guestTrial =
            isGuestTrial(
                body.guestTrial
            );

        /*
         * ---------------------------------------------
         * VALIDATE IMAGE
         * ---------------------------------------------
         */

        if (!imageUrl) {
            return NextResponse.json(
                {
                    error:
                        "Image is required.",
                },
                {
                    status:
                        400,
                }
            );
        }

        if (
            !isAllowedImageUrl(
                imageUrl
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid image URL.",
                },
                {
                    status:
                        400,
                }
            );
        }

        /*
         * ---------------------------------------------
         * VALIDATE PROMPT
         *
         * This is the important fix.
         *
         * Guest trial prompts may now be custom text.
         * They are NOT compared against an exact whitelist.
         * ---------------------------------------------
         */

        if (!userPrompt) {
            return NextResponse.json(
                {
                    error:
                        guestTrial
                            ? "Tell AI what kind of meme you want."
                            : "Prompt is required.",
                },
                {
                    status:
                        400,
                }
            );
        }

        if (
            userPrompt.length >
            MAX_PROMPT_LENGTH
        ) {
            return NextResponse.json(
                {
                    error:
                        "Prompt is too long.",
                },
                {
                    status:
                        400,
                }
            );
        }

        /*
         * ---------------------------------------------
         * AUTH
         *
         * NORMAL CREATE:
         * must be logged in.
         *
         * GUEST PREVIEW:
         * no login required.
         *
         * This endpoint only returns a caption.
         * It does NOT insert generations into Supabase.
         * The authenticated frontend does the database insert.
         * ---------------------------------------------
         */

        if (!guestTrial) {
            const supabase =
                await createClient();

            const {
                data: {
                    user,
                },
                error:
                    authError,
            } =
                await supabase.auth.getUser();

            if (
                authError ||
                !user
            ) {
                return NextResponse.json(
                    {
                        error:
                            "You must be logged in to publish a meme.",
                    },
                    {
                        status:
                            401,
                    }
                );
            }
        }

        /*
         * ---------------------------------------------
         * DOWNLOAD IMAGE
         * ---------------------------------------------
         */

        const {
            base64,
            mimeType,
        } =
            await downloadImage(
                imageUrl,
                mimeTypeFromClient
            );

        /*
         * ---------------------------------------------
         * BUILD SAFE FINAL PROMPT
         * ---------------------------------------------
         */

        const finalPrompt =
            buildFinalPrompt(
                userPrompt,
                guestTrial
            );

        /*
         * ---------------------------------------------
         * GENERATE
         * ---------------------------------------------
         */

        const ai =
            new GoogleGenAI({
                apiKey,
            });

        const result =
            await generateWithFallback(
                ai,
                base64,
                mimeType,
                finalPrompt
            );

        /*
         * ---------------------------------------------
         * SUCCESS
         * ---------------------------------------------
         */

        return NextResponse.json(
            {
                caption:
                result.caption,

                model:
                result.model,

                guestTrial,
            }
        );
    } catch (error) {
        console.error(
            "Gemini route error:",
            error
        );

        /*
         * Temporary Gemini overload
         */
        if (
            isRetryableError(
                error
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "AI is busy right now. Please try again in a moment.",
                },
                {
                    status:
                        503,
                }
            );
        }

        const message =
            error instanceof Error
                ? error.message
                : "";

        /*
         * Do not expose giant raw Gemini/API errors to users.
         */
        if (
            message ===
            "Unsupported image type." ||
            message ===
            "Image is too large." ||
            message ===
            "The image is empty."
        ) {
            return NextResponse.json(
                {
                    error:
                    message,
                },
                {
                    status:
                        400,
                }
            );
        }

        return NextResponse.json(
            {
                error:
                    "Couldn’t generate this meme. Please try again.",
            },
            {
                status:
                    500,
            }
        );
    }
}