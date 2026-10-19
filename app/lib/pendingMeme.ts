export const PENDING_MEME_KEY =
    "memeLabPendingMeme";

export const RESUME_MEME_COOKIE =
    "meme_lab_resume";

export type PendingSourcePost = {
    id: string;
    created_at: string;
    user_id: string;
    image_url: string;
    prompt: string;
    caption: string;
};

export type PendingMeme = {
    version: 1;

    imageUrl: string;

    caption: string;

    prompt: string;

    sourcePost:
        PendingSourcePost;

    savedAt: number;
};

function isBrowser() {
    return (
        typeof window !==
        "undefined"
    );
}

function isValidPendingMeme(
    value: unknown
): value is PendingMeme {
    if (
        !value ||
        typeof value !==
        "object"
    ) {
        return false;
    }

    const pending =
        value as Partial<PendingMeme>;

    if (
        pending.version !== 1
    ) {
        return false;
    }

    if (
        typeof pending.imageUrl !==
        "string" ||
        !pending.imageUrl
    ) {
        return false;
    }

    if (
        typeof pending.caption !==
        "string" ||
        !pending.caption
    ) {
        return false;
    }

    if (
        typeof pending.prompt !==
        "string"
    ) {
        return false;
    }

    if (
        typeof pending.savedAt !==
        "number"
    ) {
        return false;
    }

    if (
        !pending.sourcePost ||
        typeof pending.sourcePost !==
        "object"
    ) {
        return false;
    }

    const source =
        pending.sourcePost;

    if (
        typeof source.id !==
        "string" ||
        typeof source.created_at !==
        "string" ||
        typeof source.user_id !==
        "string" ||
        typeof source.image_url !==
        "string" ||
        typeof source.prompt !==
        "string" ||
        typeof source.caption !==
        "string"
    ) {
        return false;
    }

    /*
     * The preview must still reference
     * the exact image from its source post.
     */
    if (
        source.image_url !==
        pending.imageUrl
    ) {
        return false;
    }

    return true;
}

/*
 * Save the guest meme right before
 * sending the user to signup.
 *
 * We also create a short-lived cookie.
 * The server-side /profile layout can read
 * this cookie and immediately redirect
 * the newly signed-up user back to Meme Lab.
 */
export function savePendingMemeForSignup(
    pending: PendingMeme
) {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.setItem(
        PENDING_MEME_KEY,
        JSON.stringify(
            pending
        )
    );

    document.cookie =
        `${RESUME_MEME_COOKIE}=1; ` +
        `path=/; ` +
        `max-age=1800; ` +
        `SameSite=Lax`;
}

/*
 * Update only localStorage.
 *
 * We use this AFTER signup if the user
 * rewrites their restored meme again.
 *
 * We intentionally do not recreate the
 * redirect cookie.
 */
export function updatePendingMeme(
    pending: PendingMeme
) {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.setItem(
        PENDING_MEME_KEY,
        JSON.stringify(
            pending
        )
    );
}

export function readPendingMeme():
    | PendingMeme
    | null {
    if (!isBrowser()) {
        return null;
    }

    const raw =
        window.localStorage.getItem(
            PENDING_MEME_KEY
        );

    if (!raw) {
        return null;
    }

    try {
        const parsed =
            JSON.parse(raw);

        if (
            !isValidPendingMeme(
                parsed
            )
        ) {
            window.localStorage.removeItem(
                PENDING_MEME_KEY
            );

            return null;
        }

        return parsed;
    } catch {
        window.localStorage.removeItem(
            PENDING_MEME_KEY
        );

        return null;
    }
}

/*
 * Remove only the short-lived redirect cookie.
 *
 * We do this once the user successfully returns
 * to Dashboard. The actual pending meme remains
 * stored until they either post it or discard it.
 */
export function clearResumeMemeCookie() {
    if (!isBrowser()) {
        return;
    }

    document.cookie =
        `${RESUME_MEME_COOKIE}=; ` +
        `path=/; ` +
        `max-age=0; ` +
        `SameSite=Lax`;
}

/*
 * Fully remove the pending meme.
 *
 * Called after:
 *
 * - successful post
 * - user chooses Try another image
 */
export function clearPendingMeme() {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.removeItem(
        PENDING_MEME_KEY
    );

    clearResumeMemeCookie();
}