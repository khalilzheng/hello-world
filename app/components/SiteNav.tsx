"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

import styles from "./SiteNav.module.css";

type SiteNavProps = {
    userId?: string | null;

    onHomeClick?: () => void;
    onCreateClick?: () => void;
    onExploreClick?: () => void;
};

export default function SiteNav({
                                    userId = null,
                                    onHomeClick,
                                    onCreateClick,
                                    onExploreClick,
                                }: SiteNavProps) {
    const router = useRouter();
    const pathname = usePathname();

    const supabase = useMemo(
        () => createClient(),
        []
    );

    /*
     * IMPORTANT:
     *
     * We do NOT blindly trust the server prop forever.
     * After OAuth, Supabase may update the browser session
     * before an old rendered page knows about it.
     *
     * This local auth state fixes that.
     */
    const [currentUserId, setCurrentUserId] =
        useState<string | null>(userId);

    const lastUserIdRef =
        useRef<string | null>(userId);

    useEffect(() => {
        let mounted = true;

        async function syncAuth() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!mounted) {
                return;
            }

            const nextUserId =
                user?.id ?? null;

            setCurrentUserId(nextUserId);

            /*
             * If the server rendered one auth state,
             * but the browser has another, refresh the
             * server components once.
             */
            if (
                nextUserId !==
                lastUserIdRef.current
            ) {
                lastUserIdRef.current =
                    nextUserId;

                router.refresh();
            }
        }

        void syncAuth();

        const {
            data: {
                subscription,
            },
        } =
            supabase.auth.onAuthStateChange(
                (_event, session) => {
                    const nextUserId =
                        session?.user?.id ??
                        null;

                    setCurrentUserId(
                        nextUserId
                    );

                    if (
                        nextUserId !==
                        lastUserIdRef.current
                    ) {
                        lastUserIdRef.current =
                            nextUserId;

                        router.refresh();
                    }
                }
            );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [
        router,
        supabase,
    ]);

    async function handleLogout() {
        await supabase.auth.signOut();

        setCurrentUserId(null);
        lastUserIdRef.current = null;

        router.replace("/dashboard");
        router.refresh();
    }

    function handleHome() {
        if (onHomeClick) {
            onHomeClick();
            return;
        }

        router.push("/dashboard");
    }

    function handleCreate() {
        if (onCreateClick) {
            onCreateClick();
            return;
        }

        router.push(
            "/dashboard?focus=create"
        );
    }

    function handleExplore() {
        if (onExploreClick) {
            onExploreClick();
            return;
        }

        router.push(
            "/dashboard?view=explore"
        );
    }

    return (
        <header
            className={styles.nav}
        >
            <button
                type="button"
                className={styles.brand}
                onClick={handleHome}
            >
        <span
            className={
                styles.brandMark
            }
        >
          M
        </span>

                <span>
          Meme Lab
        </span>
            </button>

            <nav
                className={styles.centerNav}
            >
                <button
                    type="button"
                    onClick={handleHome}
                >
                    Home
                </button>

                <button
                    type="button"
                    onClick={handleCreate}
                >
                    Create
                </button>

                <button
                    type="button"
                    onClick={
                        handleExplore
                    }
                >
                    Explore
                </button>
            </nav>

            <div
                className={styles.actions}
            >
                {currentUserId ? (
                    <>
                        {pathname !==
                            "/profile" && (
                                <button
                                    type="button"
                                    className={
                                        styles.secondaryButton
                                    }
                                    onClick={() =>
                                        router.push(
                                            "/profile"
                                        )
                                    }
                                >
                                    Profile
                                </button>
                            )}

                        <button
                            type="button"
                            className={
                                styles.secondaryButton
                            }
                            onClick={() =>
                                void handleLogout()
                            }
                        >
                            Log out
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            className={
                                styles.secondaryButton
                            }
                            onClick={() =>
                                router.push(
                                    "/login"
                                )
                            }
                        >
                            Log in
                        </button>

                        <button
                            type="button"
                            className={
                                styles.signupButton
                            }
                            onClick={() =>
                                router.push(
                                    "/signup"
                                )
                            }
                        >
                            Sign up for free
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}