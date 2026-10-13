import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const FALLBACK_RETRY_DELAY_MS = 800;

const MAX_IMAGE_BYTES =
    10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);

type GenerateResult = {
    caption: string;
    model: string;
};


/*
 * Small delay used only before the
 * second fallback attempt.
 */
function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}


/*
 * Convert the downloaded image into
 * base64 so Gemini can analyze it.
 */
function arrayBufferToBase64(
    buffer: ArrayBuffer
) {
    return Buffer.from(buffer).toString(
        "base64"
    );
}


/*
 * Clean Gemini output before saving it.
 */
function cleanCaption(text: string) {
    return text
        .trim()
        .replace(/^["“”']+/, "")
        .replace(/["“”']+$/, "")
        .replace(/\s+/g, " ");
}


/*
 * Determine whether the error looks
 * temporary and worth retrying.
 */
function isRetryableError(
    error: unknown
) {
    const message =
        error instanceof Error
            ? error.message
            : String(error);

    const normalized =
        message.toLowerCase();

    return (
        normalized.includes("503") ||
        normalized.includes("429") ||
        normalized.includes("unavailable") ||
        normalized.includes(
            "resource_exhausted"
        ) ||
        normalized.includes("high demand") ||
        normalized.includes("rate limit") ||
        normalized.includes("timeout") ||
        normalized.includes("timed out") ||
        normalized.includes(
            "temporarily unavailable"
        )
    );
}


/*
 * Call one Gemini model exactly once.
 *
 * There is intentionally no retry loop
 * inside this function.
 */
async function callModel({
                             ai,
                             model,
                             imageBase64,
                             mimeType,
                             prompt,
                         }: {
    ai: GoogleGenAI;
    model: string;
    imageBase64: string;
    mimeType: string;
    prompt: string;
}) {
    console.log(
        `Calling ${model}...`
    );

    const generationInstruction = `
You are writing ONE short meme caption for an uploaded image.

The user described the situation as:

${prompt}

Requirements:
- Return exactly ONE meme caption.
- Maximum 12 words.
- Use the uploaded image naturally.
- The caption must make sense with what is visible in the image.
- Keep it concise and immediately understandable.
- Make it witty and internet-friendly.
- Columbia University, campus life, and NYC humor are welcome when relevant.
- Do not explain the joke.
- Do not describe your process.
- Do not provide multiple options.
- Do not include quotation marks around the answer.
- Return ONLY the final meme caption.
`.trim();

    const response =
        await ai.models.generateContent({
            model,

            contents: [
                {
                    role: "user",

                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: imageBase64,
                            },
                        },

                        {
                            text:
                            generationInstruction,
                        },
                    ],
                },
            ],
        });

    const rawText =
        response.text?.trim() ?? "";

    if (!rawText) {
        throw new Error(
            `${model} returned an empty response.`
        );
    }

    const caption =
        cleanCaption(rawText);

    if (!caption) {
        throw new Error(
            `${model} returned no usable caption.`
        );
    }

    console.log(
        `Caption generated using ${model}:`,
        caption
    );

    return caption;
}


/*
 * Main generation strategy.
 *
 * 1. Primary model once.
 * 2. Fallback model once.
 * 3. If fallback fails temporarily,
 *    wait 800ms and try fallback once more.
 */
async function generateCaption({
                                   ai,
                                   imageBase64,
                                   mimeType,
                                   prompt,
                               }: {
    ai: GoogleGenAI;
    imageBase64: string;
    mimeType: string;
    prompt: string;
}): Promise<GenerateResult> {

    /*
     * ========================================
     * PRIMARY MODEL
     * ========================================
     */

    try {
        const caption =
            await callModel({
                ai,
                model: PRIMARY_MODEL,
                imageBase64,
                mimeType,
                prompt,
            });

        return {
            caption,
            model: PRIMARY_MODEL,
        };
    } catch (primaryError) {
        if (
            isRetryableError(primaryError)
        ) {
            console.warn(
                `${PRIMARY_MODEL} is temporarily unavailable. Switching to ${FALLBACK_MODEL}.`
            );
        } else {
            console.warn(
                `${PRIMARY_MODEL} failed. Switching to ${FALLBACK_MODEL}.`,
                primaryError
            );
        }
    }


    /*
     * ========================================
     * FALLBACK — ATTEMPT 1
     * ========================================
     */

    try {
        const caption =
            await callModel({
                ai,
                model: FALLBACK_MODEL,
                imageBase64,
                mimeType,
                prompt,
            });

        return {
            caption,
            model: FALLBACK_MODEL,
        };
    } catch (fallbackError) {
        /*
         * If this is NOT a temporary problem,
         * retrying immediately is unlikely
         * to help.
         */
        if (
            !isRetryableError(
                fallbackError
            )
        ) {
            console.error(
                `${FALLBACK_MODEL} failed with a non-retryable error:`,
                fallbackError
            );

            throw new Error(
                "GENERATION_UNAVAILABLE"
            );
        }

        console.warn(
            `${FALLBACK_MODEL} is temporarily busy. Retrying once in ${FALLBACK_RETRY_DELAY_MS}ms...`
        );
    }


    /*
     * ========================================
     * FALLBACK — ATTEMPT 2
     * ========================================
     */

    await sleep(
        FALLBACK_RETRY_DELAY_MS
    );

    try {
        const caption =
            await callModel({
                ai,
                model: FALLBACK_MODEL,
                imageBase64,
                mimeType,
                prompt,
            });

        return {
            caption,
            model: FALLBACK_MODEL,
        };
    } catch (finalError) {
        console.error(
            "All Gemini generation attempts failed:",
            finalError
        );

        throw new Error(
            "GENERATION_UNAVAILABLE"
        );
    }
}


/*
 * =====================================================
 * POST /api/generate-caption
 * =====================================================
 */

export async function POST(
    request: Request
) {
    try {

        /*
         * ========================================
         * 1. AUTHENTICATION
         * ========================================
         */

        const supabase =
            await createClient();

        const {
            data: { user },
            error: authError,
        } =
            await supabase.auth.getUser();

        if (
            authError ||
            !user
        ) {
            return NextResponse.json(
                {
                    error:
                        "Please log in to generate a meme.",
                },
                {
                    status: 401,
                }
            );
        }


        /*
         * ========================================
         * 2. GEMINI API KEY
         * ========================================
         */

        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error(
                "GEMINI_API_KEY is missing."
            );

            return NextResponse.json(
                {
                    error:
                        "AI generation is temporarily unavailable.",
                },
                {
                    status: 500,
                }
            );
        }


        /*
         * ========================================
         * 3. READ REQUEST
         * ========================================
         */

        let body: {
            imageUrl?: unknown;
            mimeType?: unknown;
            prompt?: unknown;
        };

        try {
            body =
                await request.json();
        } catch {
            return NextResponse.json(
                {
                    error:
                        "Invalid request.",
                },
                {
                    status: 400,
                }
            );
        }


        const imageUrl =
            typeof body.imageUrl ===
            "string"
                ? body.imageUrl.trim()
                : "";

        const mimeType =
            typeof body.mimeType ===
            "string"
                ? body.mimeType.trim()
                : "";

        const prompt =
            typeof body.prompt ===
            "string"
                ? body.prompt.trim()
                : "";


        /*
         * ========================================
         * 4. VALIDATE USER INPUT
         * ========================================
         */

        if (!imageUrl) {
            return NextResponse.json(
                {
                    error:
                        "Please add an image first.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!prompt) {
            return NextResponse.json(
                {
                    error:
                        "Describe the meme you want to create.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !ALLOWED_MIME_TYPES.has(
                mimeType
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Unsupported image type.",
                },
                {
                    status: 400,
                }
            );
        }


        /*
         * ========================================
         * 5. VALIDATE IMAGE URL
         * ========================================
         */

        const supabaseUrl =
            process.env
                .NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
            console.error(
                "NEXT_PUBLIC_SUPABASE_URL is missing."
            );

            return NextResponse.json(
                {
                    error:
                        "Image service is temporarily unavailable.",
                },
                {
                    status: 500,
                }
            );
        }

        const expectedPrefix =
            `${supabaseUrl}/storage/v1/object/public/meme-images/`;

        if (
            !imageUrl.startsWith(
                expectedPrefix
            )
        ) {
            console.warn(
                "Rejected image URL:",
                imageUrl
            );

            return NextResponse.json(
                {
                    error:
                        "Invalid image URL.",
                },
                {
                    status: 400,
                }
            );
        }


        /*
         * ========================================
         * 6. DOWNLOAD IMAGE
         * ========================================
         */

        let imageResponse: Response;

        try {
            imageResponse =
                await fetch(
                    imageUrl,
                    {
                        cache: "no-store",
                    }
                );
        } catch (error) {
            console.error(
                "Could not download image:",
                error
            );

            return NextResponse.json(
                {
                    error:
                        "Couldn’t read the uploaded image. Try again.",
                },
                {
                    status: 502,
                }
            );
        }

        if (
            !imageResponse.ok
        ) {
            console.error(
                "Image download HTTP status:",
                imageResponse.status
            );

            return NextResponse.json(
                {
                    error:
                        "Couldn’t read the uploaded image. Try again.",
                },
                {
                    status: 502,
                }
            );
        }


        /*
         * ========================================
         * 7. CHECK IMAGE SIZE
         * ========================================
         */

        const imageBuffer =
            await imageResponse.arrayBuffer();

        if (
            imageBuffer.byteLength >
            MAX_IMAGE_BYTES
        ) {
            return NextResponse.json(
                {
                    error:
                        "Image must be 10 MB or smaller.",
                },
                {
                    status: 400,
                }
            );
        }

        const imageBase64 =
            arrayBufferToBase64(
                imageBuffer
            );


        /*
         * ========================================
         * 8. CREATE GEMINI CLIENT
         * ========================================
         */

        const ai =
            new GoogleGenAI({
                apiKey,
            });


        /*
         * ========================================
         * 9. GENERATE CAPTION
         * ========================================
         */

        let result:
            GenerateResult;

        try {
            result =
                await generateCaption({
                    ai,
                    imageBase64,
                    mimeType,
                    prompt,
                });
        } catch (error) {
            /*
             * Full technical error stays
             * in Terminal only.
             */
            console.error(
                "Meme generation failed:",
                error
            );

            /*
             * Users receive ONLY this
             * friendly message.
             */
            return NextResponse.json(
                {
                    error:
                        "Couldn’t generate this one. Try again in a moment.",
                },
                {
                    status: 503,
                }
            );
        }


        /*
         * ========================================
         * 10. SUCCESS
         * ========================================
         */

        return NextResponse.json(
            {
                caption:
                result.caption,

                model:
                result.model,
            },
            {
                status: 200,
            }
        );

    } catch (error) {

        /*
         * Final safety net.
         */
        console.error(
            "Unexpected /api/generate-caption error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Couldn’t generate this one. Try again in a moment.",
            },
            {
                status: 500,
            }
        );
    }
}