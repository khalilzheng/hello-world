import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const ALLOWED_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
]);

const MAX_MODEL_RETRIES = 3;
const MAX_CAPTION_ATTEMPTS = 3;

function cleanCaption(text: string) {
    let caption = text.trim();

    // Remove markdown/code fences if Gemini ever adds them
    caption = caption.replace(/^```(?:text)?/i, "");
    caption = caption.replace(/```$/i, "");

    // Remove labels that Gemini sometimes adds
    caption = caption.replace(/^caption\s*:\s*/i, "");
    caption = caption.replace(/^final caption\s*:\s*/i, "");

    // Remove surrounding quotation marks
    caption = caption.replace(/^["“](.*)["”]$/s, "$1");

    return caption.trim();
}

function looksLikeBadMemeLogic(caption: string) {
    const lower = caption.toLowerCase();

    /*
     * These are common meme constructions that frequently create
     * fake / backwards logic.
     *
     * Example:
     * "Can't miss lecture if you never show up."
     */
    const badPatterns = [
        /can't miss .* if you never/i,
        /cannot miss .* if you never/i,
        /can't fail .* if you never/i,
        /cannot fail .* if you never/i,
        /can't be late .* if you never/i,
        /cannot be late .* if you never/i,
        /can't lose .* if you never/i,
        /cannot lose .* if you never/i,
    ];

    if (badPatterns.some((pattern) => pattern.test(caption))) {
        return true;
    }

    // Reject obvious meta responses
    if (
        lower.startsWith("here's") ||
        lower.startsWith("here is") ||
        lower.startsWith("caption:") ||
        lower.includes("as an ai")
    ) {
        return true;
    }

    return false;
}

function buildCaptionPrompt(
    userPrompt: string,
    rejectedCaptions: string[] = []
) {
    const rejectedSection =
        rejectedCaptions.length > 0
            ? `
PREVIOUS BAD ATTEMPTS:
${rejectedCaptions.map((caption) => `- "${caption}"`).join("\n")}

Those captions were rejected because the joke was logically weak,
contradictory, or based on fake cause-and-effect.

DO NOT repeat their reasoning or structure.
`
            : "";

    return `
You are writing ONE short meme caption for an image.

The user gave this scenario or idea:

"${userPrompt}"

Your job is to look at BOTH:
1. the uploaded image
2. the user's scenario

Then write ONE funny caption that connects them naturally.

This app is mainly designed for college students, especially a
chronically-online Columbia University student living in New York City.

IMPORTANT RULES:

1. LOGIC COMES FIRST.
The caption must make sense when read literally.

2. Treat the user's scenario as factual.
Do NOT contradict what the user told you.

3. Preserve cause and effect.
If the user's prompt says someone does X because of Y,
do not reverse that relationship.

4. DO NOT create fake logic just because it sounds like a meme.

BAD EXAMPLE:
User scenario:
"A student skips lecture because the slides are already online."

BAD caption:
"Can't miss lecture if you never show up."

Why it is bad:
Not showing up IS missing lecture, so the sentence contradicts itself.

BETTER:
"The slides are on CourseWorks. Attendance suddenly feels optional."

Another good direction:
"CourseWorks posted the slides, so apparently I've graduated from attendance."

5. Avoid these lazy meme structures unless they are genuinely logical:
- "Can't X if you never Y"
- "Can't fail X if you never Y"
- "Can't be late if..."
- fake philosophical loopholes
- meaningless cause-and-effect reversals

6. Humor should come from:
- exaggeration
- relatability
- irony
- the person's facial expression
- college life
- Columbia / NYC culture when relevant

Humor should NOT come from a sentence that simply makes no sense.

7. Pay attention to the image.
Use the person's or animal's expression, body language, or situation
when it helps the joke.

8. Do not merely restate the user's prompt.
Transform it into a punchline.

9. Keep it concise.
Prefer 6–14 words unless the user specifically asks for something else.

10. Do not explain the joke.

11. Do not include:
- "Caption:"
- quotation marks around the answer
- multiple choices
- analysis
- explanations

12. Before answering, silently ask yourself:

A. Does this sentence make literal sense?
B. Does it preserve the user's scenario?
C. Did I accidentally reverse cause and effect?
D. Would a college student understand the joke immediately?
E. Does the caption fit the image?

If ANY answer is no, rewrite the caption before responding.

Internally consider several possible captions.
Choose only the clearest and funniest logically coherent one.

${rejectedSection}

OUTPUT ONLY THE FINAL CAPTION.
`;
}

function isRetryableError(error: unknown) {
    const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
        message.includes("503") ||
        message.includes("429") ||
        message.includes("unavailable") ||
        message.includes("resource_exhausted") ||
        message.includes("high demand") ||
        message.includes("overloaded")
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
    ai: GoogleGenAI,
    modelName: string,
    imageBase64: string,
    mimeType: string,
    prompt: string
) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_MODEL_RETRIES; attempt++) {
        try {
            console.log(`Calling ${modelName}, attempt ${attempt}...`);

            const response = await ai.models.generateContent({
                model: modelName,
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
                                text: prompt,
                            },
                        ],
                    },
                ],
            });

            const text = response.text;

            if (!text || !text.trim()) {
                throw new Error(`${modelName} returned an empty response.`);
            }

            return cleanCaption(text);
        } catch (error) {
            lastError = error;

            console.error(
                `${modelName} attempt ${attempt} failed:`,
                error
            );

            if (!isRetryableError(error) || attempt === MAX_MODEL_RETRIES) {
                throw error;
            }

            // 1 second after first failure, 2 seconds after second failure
            await sleep(attempt * 1000);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`Failed to call ${modelName}.`);
}

async function generateCaption(
    ai: GoogleGenAI,
    imageBase64: string,
    mimeType: string,
    userPrompt: string
) {
    const rejectedCaptions: string[] = [];

    /*
     * We allow a few caption attempts.
     *
     * If Gemini falls into one of the obviously broken meme-logic
     * templates, we automatically reject it and ask again.
     */
    for (
        let captionAttempt = 1;
        captionAttempt <= MAX_CAPTION_ATTEMPTS;
        captionAttempt++
    ) {
        const finalPrompt = buildCaptionPrompt(
            userPrompt,
            rejectedCaptions
        );

        let caption: string;
        let modelUsed: string;

        try {
            caption = await callGemini(
                ai,
                PRIMARY_MODEL,
                imageBase64,
                mimeType,
                finalPrompt
            );

            modelUsed = PRIMARY_MODEL;
        } catch (primaryError) {
            console.warn(
                `${PRIMARY_MODEL} failed. Trying ${FALLBACK_MODEL}...`,
                primaryError
            );

            caption = await callGemini(
                ai,
                FALLBACK_MODEL,
                imageBase64,
                mimeType,
                finalPrompt
            );

            modelUsed = FALLBACK_MODEL;
        }

        console.log(
            `Caption attempt ${captionAttempt} using ${modelUsed}:`,
            caption
        );

        if (!looksLikeBadMemeLogic(caption)) {
            return {
                caption,
                model: modelUsed,
            };
        }

        console.warn(
            "Rejected caption because it matched a bad-logic pattern:",
            caption
        );

        rejectedCaptions.push(caption);
    }

    /*
     * This would be extremely unusual, but if all attempts fall into
     * one of our known bad patterns, fail instead of storing nonsense.
     */
    throw new Error(
        "The AI kept generating logically inconsistent captions. Please try again."
    );
}

export async function POST(request: Request) {
    try {
        // ---------------------------------------------------------
        // 1. Confirm that the user is logged in
        // ---------------------------------------------------------

        const supabase = await createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
            console.error("Supabase auth error:", userError);
        }

        if (!user) {
            return NextResponse.json(
                {
                    error: "You must be logged in to generate a meme.",
                },
                {
                    status: 401,
                }
            );
        }

        // ---------------------------------------------------------
        // 2. Confirm that Gemini API key exists
        // ---------------------------------------------------------

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error("GEMINI_API_KEY is missing.");

            return NextResponse.json(
                {
                    error: "Gemini API key is not configured.",
                },
                {
                    status: 500,
                }
            );
        }

        // ---------------------------------------------------------
        // 3. Read request body
        // ---------------------------------------------------------

        const body = await request.json();

        const imageUrl =
            typeof body.imageUrl === "string"
                ? body.imageUrl.trim()
                : "";

        const mimeType =
            typeof body.mimeType === "string"
                ? body.mimeType.trim().toLowerCase()
                : "";

        const userPrompt =
            typeof body.prompt === "string"
                ? body.prompt.trim()
                : "";

        // ---------------------------------------------------------
        // 4. Validate input
        // ---------------------------------------------------------

        if (!imageUrl) {
            return NextResponse.json(
                {
                    error: "Image URL is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!userPrompt) {
            return NextResponse.json(
                {
                    error: "Prompt is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return NextResponse.json(
                {
                    error:
                        "Unsupported image type. Please use PNG, JPEG, WEBP, or GIF.",
                },
                {
                    status: 400,
                }
            );
        }

        // ---------------------------------------------------------
        // 5. Make sure Gemini can only fetch images from our bucket
        // ---------------------------------------------------------

        const supabaseUrl =
            process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
            return NextResponse.json(
                {
                    error: "Supabase URL is not configured.",
                },
                {
                    status: 500,
                }
            );
        }

        const expectedImagePrefix =
            `${supabaseUrl}/storage/v1/object/public/meme-images/`;

        if (!imageUrl.startsWith(expectedImagePrefix)) {
            return NextResponse.json(
                {
                    error: "Invalid image URL.",
                },
                {
                    status: 400,
                }
            );
        }

        // ---------------------------------------------------------
        // 6. Download image from Supabase Storage
        // ---------------------------------------------------------

        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
            console.error(
                "Could not download image:",
                imageResponse.status,
                imageResponse.statusText
            );

            return NextResponse.json(
                {
                    error: "Could not load the uploaded image.",
                },
                {
                    status: 400,
                }
            );
        }

        const imageArrayBuffer =
            await imageResponse.arrayBuffer();

        const imageBase64 =
            Buffer.from(imageArrayBuffer).toString("base64");

        // ---------------------------------------------------------
        // 7. Call Gemini
        // ---------------------------------------------------------

        const ai = new GoogleGenAI({
            apiKey,
        });

        const result = await generateCaption(
            ai,
            imageBase64,
            mimeType,
            userPrompt
        );

        console.log(
            `Caption generated using ${result.model}:`,
            result.caption
        );

        // ---------------------------------------------------------
        // 8. Return caption to frontend
        // ---------------------------------------------------------

        return NextResponse.json({
            caption: result.caption,
            model: result.model,
        });
    } catch (error) {
        console.error("Gemini caption generation error:", error);

        const message =
            error instanceof Error
                ? error.message
                : "Unknown error.";

        return NextResponse.json(
            {
                error: `Gemini error: ${message}`,
            },
            {
                status: 500,
            }
        );
    }
}