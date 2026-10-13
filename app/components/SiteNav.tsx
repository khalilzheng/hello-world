"use client";

import Link from "next/link";
import {
    usePathname,
    useRouter,
} from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import styles from "./SiteNav.module.css";

type Props = {
    userId: string | null;
    onHomeClick?: () => void;
    onCreateClick?: () => void;
    onExploreClick?: () => void;
};

export default function SiteNav({
                                    userId,
                                    onHomeClick,
                                    onCreateClick,
                                    onExploreClick,
                                }: Props) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const loggedIn = Boolean(userId);
    const onProfilePage =
        pathname === "/profile";

    function goHome() {
        if (onHomeClick) {
            onHomeClick();
            return;
        }

        router.push("/dashboard");
    }

    function goCreate() {
        if (onCreateClick) {
            onCreateClick();
            return;
        }

        router.push("/dashboard#create");
    }

    function goExplore() {
        if (onExploreClick) {
            onExploreClick();
            return;
        }

        router.push(
            "/dashboard#community"
        );
    }

    async function handleLogout() {
        try {
            await supabase.auth.signOut();

            router.push("/dashboard");
            router.refresh();
        } catch (error) {
            console.warn(error);
        }
    }

    return (
        <header className={styles.nav}>
            <div className={styles.navInner}>
                <button
                    type="button"
                    className={styles.brand}
                    onClick={goHome}
                    aria-label="Go to Meme Lab home"
                >
          <span className={styles.brandMark}>
            M
          </span>

                    <span className={styles.brandText}>
            Meme Lab
          </span>
                </button>

                <nav
                    className={styles.centerNav}
                    aria-label="Main navigation"
                >
                    <button
                        type="button"
                        onClick={goHome}
                    >
                        Home
                    </button>

                    <button
                        type="button"
                        onClick={goCreate}
                    >
                        Create
                    </button>

                    <button
                        type="button"
                        onClick={goExplore}
                    >
                        Explore
                    </button>
                </nav>

                <div className={styles.actions}>
                    {loggedIn ? (
                        <>
                            {!onProfilePage && (
                                <Link
                                    href="/profile"
                                    className={
                                        styles.secondaryButton
                                    }
                                >
                                    Profile
                                </Link>
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
                            <Link
                                href="/login"
                                className={
                                    styles.loginButton
                                }
                            >
                                Log in
                            </Link>

                            <Link
                                href="/signup"
                                className={
                                    styles.signupButton
                                }
                            >
                                Sign up for free
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}