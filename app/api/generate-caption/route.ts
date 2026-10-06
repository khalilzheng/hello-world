import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

function sleep(ms: number) {
    return new Promise((resolve) =>
        setTimeout(resolve, ms)
    );
}

function errorMessage(
    error: unknown
) {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

function isRetryableError(
    error: unknown
) {
    const message =
        errorMessage(error);

    return (
        message.includes("503") ||
        message.includes("429") ||
        message.includes(
            "UNAVAILABLE"
        ) ||
        message.includes(
            "RESOURCE_EXHAUSTED"
        ) ||
        message
            .toLowerCase()
            .includes("high demand")
    );
}

async function generateWithModel(
    ai: GoogleGenAI,
    model: string,
    base64Image: string,
    mimeType: string,
    finalPrompt: string
) {
    let lastError: unknown;

    for (
        let attempt = 0;
        attempt < 3;
        attempt++
    ) {
        try {
            console.log(
                `Calling ${model}, attempt ${attempt + 1}...`
            );

            return await ai.models.generateContent(
                {
                    model,

                    contents: [
                        {
                            inlineData: {
                                mimeType,
                                data:
                                base64Image,
                            },
                        },

                        {
                            text:
                            finalPrompt,
                        },
                    ],
                }
            );
        } catch (error) {
            lastError = error;

            console.warn(
                `${model} attempt ${attempt + 1} failed:`,
                errorMessage(error)
            );

            if (
                !isRetryableError(
                    error
                )
            ) {
                throw error;
            }

            if (attempt < 2) {
                const delay =
                    1000 *
                    Math.pow(
                        2,
                        attempt
                    );

                await sleep(
                    delay
                );
            }
        }
    }

    throw lastError;
}

export async function POST(
    request: Request
) {
    try {
        // ---------------------------------------------
        // CHECK LOGIN
        // ---------------------------------------------

        const supabase =
            await createClient();

        const {
            data: { user },
        } =
            await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                {
                    error:
                        "You must be logged in.",
                },
                {
                    status: 401,
                }
            );
        }

        // ---------------------------------------------
        // GEMINI KEY
        // ---------------------------------------------

        const apiKey =
            process.env
                .GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                {
                    error:
                        "GEMINI_API_KEY is missing from .env.local.",
                },
                {
                    status: 500,
                }
            );
        }

        // ---------------------------------------------
        // REQUEST
        // ---------------------------------------------

        const body =
            await request.json();

        const imageUrl =
            body.imageUrl;

        const mimeType =
            body.mimeType;

        const userPrompt =
            body.prompt;

        if (
            typeof imageUrl !==
            "string" ||
            typeof mimeType !==
            "string" ||
            typeof userPrompt !==
            "string"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Image URL, MIME type, and prompt are required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !userPrompt.trim()
        ) {
            return NextResponse.json(
                {
                    error:
                        "Prompt cannot be empty.",
                },
                {
                    status: 400,
                }
            );
        }

        // ---------------------------------------------
        // IMAGE TYPE
        // ---------------------------------------------

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif",
        ];

        if (
            !allowedTypes.includes(
                mimeType
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        `Unsupported image type: ${mimeType}`,
                },
                {
                    status: 400,
                }
            );
        }

        // ---------------------------------------------
        // VALIDATE SUPABASE URL
        // ---------------------------------------------

        const supabaseUrl =
            process.env
                .NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
            return NextResponse.json(
                {
                    error:
                        "NEXT_PUBLIC_SUPABASE_URL is missing.",
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
            return NextResponse.json(
                {
                    error:
                        "Invalid meme image URL.",
                },
                {
                    status: 400,
                }
            );
        }

        // ---------------------------------------------
        // DOWNLOAD IMAGE
        // ---------------------------------------------

        const imageResponse =
            await fetch(
                imageUrl
            );

        if (
            !imageResponse.ok
        ) {
            return NextResponse.json(
                {
                    error:
                        `Could not download uploaded image. HTTP ${imageResponse.status}`,
                },
                {
                    status: 500,
                }
            );
        }

        const imageArrayBuffer =
            await imageResponse.arrayBuffer();

        const base64Image =
            Buffer.from(
                imageArrayBuffer
            ).toString("base64");

        // ---------------------------------------------
        // PROMPT
        // ---------------------------------------------

        const finalPrompt = `
Look carefully at this image and write ONE funny meme caption.

The user's direction is:
${userPrompt.trim()}

Requirements:
- Return only one caption.
- Keep it short.
- Make it witty and internet-friendly.
- College, NYC, Gen Z, and chronically-online humor are welcome when relevant.
- Do not explain the joke.
- Do not give multiple options.
- Do not put quotation marks around the caption.
`;

        const ai =
            new GoogleGenAI({
                apiKey,
            });

        // ---------------------------------------------
        // PRIMARY MODEL
        // ---------------------------------------------

        let response;

        let modelUsed =
            "gemini-3.8-flash";

        try {
            response =
                await generateWithModel(
                    ai,
                    "gemini-3.8-flash",
                    base64Image,
                    mimeType,
                    finalPrompt
                );
        } catch (
            primaryError
            ) {
            console.warn(
                "Gemini 3.8 Flash unavailable. Falling back."
            );

            console.warn(
                errorMessage(
                    primaryError
                )
            );

            // -----------------------------------------
            // FALLBACK
            // -----------------------------------------

            modelUsed =
                "gemini-3.5-flash-lite";

            response =
                await generateWithModel(
                    ai,
                    "gemini-3.5-flash-lite",
                    base64Image,
                    mimeType,
                    finalPrompt
                );
        }

        // ---------------------------------------------
        // CAPTION
        // ---------------------------------------------

        const caption =
            response.text?.trim();

        if (!caption) {
            return NextResponse.json(
                {
                    error:
                        "Gemini returned an empty caption.",
                },
                {
                    status: 500,
                }
            );
        }

        console.log(
            `Caption generated using ${modelUsed}:`,
            caption
        );

        return NextResponse.json(
            {
                caption,
                model:
                modelUsed,
            }
        );
    } catch (error) {
        console.error(
            "========== GEMINI ERROR =========="
        );

        console.error(
            error
        );

        console.error(
            "=================================="
        );

        return NextResponse.json(
            {
                error:
                    `Gemini error: ${errorMessage(error)}`,
            },
            {
                status: 500,
            }
        );
    }
}