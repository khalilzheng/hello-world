import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const fallbackPrompts = [
    "Write one short meme caption about realizing the 1 train is delayed when you are already late to class. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about pretending Butler Library at 3 AM is a healthy lifestyle choice. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about checking your bank account after one weekend in Manhattan. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about opening CourseWorks and discovering three assignments due tonight. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about your group project suddenly becoming a solo project. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about waking up five minutes before a Columbia class starts. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about registration opening and every class already being full. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about spending more money on one NYC lunch than expected. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about saying you will study early and arriving at Butler at midnight. Use the image naturally. Maximum 12 words.",

    "Write one short meme caption about getting an internship email while trying to survive midterms. Use the image naturally. Maximum 12 words.",
];

function getFallbackPrompts(count = 5) {
    return [...fallbackPrompts]
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
}

function cleanJsonResponse(text: string) {
    return text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
}

async function generateWithModel(
    ai: GoogleGenAI,
    model: string
) {
    const instruction = `
Generate 5 different meme-writing prompts for Columbia University students.

Each prompt should describe a different relatable Columbia University or New York City student situation.

Vary the topics. Possible categories include:

- classes
- midterms
- finals
- CourseWorks
- Butler Library
- dorm life
- dining halls
- the 1 train
- subway delays
- group projects
- internships
- registration
- office hours
- expensive NYC food
- weekends in Manhattan
- laundry
- student social life
- procrastination
- early morning classes
- late-night studying

Requirements:

1. Every prompt must describe a DIFFERENT situation.
2. Avoid repeating the same scenario.
3. Make the situations specific and relatable.
4. Each prompt must instruct the meme model to:
   - write ONE short meme caption
   - use the uploaded image naturally
   - use no more than 12 words
5. Do not generate the final meme caption.
6. Return ONLY a valid JSON array containing exactly 5 strings.
7. No markdown.
8. No explanation.

Example format:

[
  "Write one short meme caption about ... Use the image naturally. Maximum 12 words.",
  "Write one short meme caption about ... Use the image naturally. Maximum 12 words."
]
`;

    const response =
        await ai.models.generateContent({
            model,
            contents: instruction,
        });

    return response.text ?? "";
}

export async function POST() {
    try {
        const apiKey =
            process.env.GEMINI_API_KEY;

        /*
         * Even if Gemini is unavailable,
         * Suggest Prompt should never break.
         */
        if (!apiKey) {
            return NextResponse.json({
                prompts: getFallbackPrompts(),
                source: "fallback",
            });
        }

        const ai = new GoogleGenAI({
            apiKey,
        });

        let rawText = "";

        /*
         * Try the primary model first.
         */
        try {
            rawText =
                await generateWithModel(
                    ai,
                    "gemini-3.8-flash"
                );
        } catch (primaryError) {
            console.warn(
                "Suggest prompt primary model failed:",
                primaryError
            );

            /*
             * Fall back to the lighter model.
             */
            try {
                rawText =
                    await generateWithModel(
                        ai,
                        "gemini-3.5-flash-lite"
                    );
            } catch (fallbackError) {
                console.warn(
                    "Suggest prompt fallback model failed:",
                    fallbackError
                );

                return NextResponse.json({
                    prompts:
                        getFallbackPrompts(),
                    source: "fallback",
                });
            }
        }

        try {
            const cleaned =
                cleanJsonResponse(rawText);

            const parsed =
                JSON.parse(cleaned);

            if (
                !Array.isArray(parsed)
            ) {
                throw new Error(
                    "Gemini response was not an array."
                );
            }

            const prompts =
                parsed
                    .filter(
                        (item): item is string =>
                            typeof item ===
                            "string" &&
                            item.trim().length >
                            0
                    )
                    .map((item) =>
                        item.trim()
                    )
                    .slice(0, 5);

            if (
                prompts.length === 0
            ) {
                throw new Error(
                    "Gemini returned no usable prompts."
                );
            }

            return NextResponse.json({
                prompts,
                source: "gemini",
            });
        } catch (parseError) {
            console.warn(
                "Could not parse suggested prompts:",
                parseError
            );

            /*
             * Again: never expose an ugly
             * Gemini/API failure to the user.
             */
            return NextResponse.json({
                prompts:
                    getFallbackPrompts(),
                source: "fallback",
            });
        }
    } catch (error) {
        console.warn(
            "Suggest prompt route error:",
            error
        );

        /*
         * Final safety net.
         */
        return NextResponse.json({
            prompts:
                getFallbackPrompts(),
            source: "fallback",
        });
    }
}