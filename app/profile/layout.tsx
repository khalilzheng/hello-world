import {
    ReactNode,
} from "react";

import {
    cookies,
} from "next/headers";

import {
    redirect,
} from "next/navigation";

import {
    RESUME_MEME_COOKIE,
} from "@/app/lib/pendingMeme";

type ProfileLayoutProps = {
    children: ReactNode;
};

export default async function ProfileLayout({
                                                children,
                                            }: ProfileLayoutProps) {
    const cookieStore =
        await cookies();

    const shouldResumeMeme =
        cookieStore.get(
            RESUME_MEME_COOKIE
        )?.value === "1";

    /*
     * Only hijack /profile when the user
     * explicitly came from the guest meme
     * signup flow.
     *
     * Normal Profile visits are untouched.
     */
    if (
        shouldResumeMeme
    ) {
        redirect(
            "/dashboard?resume=meme"
        );
    }

    return (
        <>
            {children}
        </>
    );
}