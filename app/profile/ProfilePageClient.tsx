"use client";

import Link from "next/link";
import {
    ChangeEvent,
    useMemo,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import {
    createClient,
} from "@/utils/supabase/client";

import styles from "./ProfilePage.module.css";


type ProfileData = {
    firstName: string;
    lastName: string;
    avatarUrl: string;
};


type ProfilePost = {
    id: string;
    created_at: string;
    user_id: string;
    image_url: string;
    prompt: string;
    caption: string;
    funnyCount: number;
    notFunnyCount: number;
    score: number;
};


type ProfilePageClientProps = {
    userId: string;

    email: string;

    initialProfile:
        ProfileData;

    initialPosts:
        ProfilePost[];

    initialFunnyVotes: number;

    welcome: boolean;
};


export default function ProfilePageClient({
                                              userId,
                                              email,
                                              initialProfile,
                                              initialPosts,
                                              initialFunnyVotes,
                                              welcome,
                                          }: ProfilePageClientProps) {
    const router =
        useRouter();


    const supabase =
        useMemo(
            () =>
                createClient(),
            []
        );


    /*
     * ========================================
     * PROFILE STATE
     * ========================================
     */

    const [
        profile,
        setProfile,
    ] =
        useState<ProfileData>(
            initialProfile
        );


    const [
        firstName,
        setFirstName,
    ] =
        useState(
            initialProfile.firstName
        );


    const [
        lastName,
        setLastName,
    ] =
        useState(
            initialProfile.lastName
        );


    const [
        editing,
        setEditing,
    ] =
        useState(
            welcome
        );


    /*
     * ========================================
     * POSTS
     * ========================================
     */

    const [
        posts,
        setPosts,
    ] =
        useState<ProfilePost[]>(
            initialPosts
        );


    /*
     * ========================================
     * AVATAR
     * ========================================
     */

    const [
        avatarFile,
        setAvatarFile,
    ] =
        useState<File | null>(
            null
        );


    const [
        avatarUploading,
        setAvatarUploading,
    ] =
        useState(false);


    /*
     * ========================================
     * GENERAL STATE
     * ========================================
     */

    const [
        saving,
        setSaving,
    ] =
        useState(false);


    const [
        deletingId,
        setDeletingId,
    ] =
        useState<string | null>(
            null
        );


    const [
        message,
        setMessage,
    ] =
        useState("");


    const [
        errorMessage,
        setErrorMessage,
    ] =
        useState("");


    /*
     * ========================================
     * DERIVED DATA
     * ========================================
     */

    const fullName =
        [
            profile.firstName,
            profile.lastName,
        ]
            .filter(Boolean)
            .join(" ")
            .trim();


    const displayName =
        fullName ||
        email.split("@")[0] ||
        "Meme Lab User";


    const initial =
        displayName
            .charAt(0)
            .toUpperCase();


    const totalFunnyVotes =
        posts.reduce(
            (
                total,
                post
            ) =>
                total +
                post.funnyCount,
            0
        );


    /*
     * ========================================
     * NAVIGATION
     * ========================================
     */

    function goHome() {
        router.push(
            "/dashboard"
        );
    }


    function goCreate() {
        router.push(
            "/dashboard#create"
        );
    }


    function goExplore() {
        router.push(
            "/dashboard#community"
        );
    }


    /*
     * ========================================
     * LOG OUT
     * ========================================
     */

    async function handleLogout() {
        await supabase.auth.signOut();

        router.replace(
            "/dashboard"
        );

        router.refresh();
    }


    /*
     * ========================================
     * AVATAR FILE
     * ========================================
     */

    function handleAvatarFileChange(
        event:
        ChangeEvent<HTMLInputElement>
    ) {
        setMessage("");
        setErrorMessage("");


        const file =
            event.target.files?.[0];


        if (!file) {
            setAvatarFile(null);
            return;
        }


        const allowedTypes =
            new Set([
                "image/jpeg",
                "image/png",
                "image/webp",
            ]);


        if (
            !allowedTypes.has(
                file.type
            )
        ) {
            setErrorMessage(
                "Profile photos must be JPG, PNG, or WEBP."
            );

            event.target.value = "";

            return;
        }


        const maxBytes =
            5 * 1024 * 1024;


        if (
            file.size >
            maxBytes
        ) {
            setErrorMessage(
                "Profile photo must be 5 MB or smaller."
            );

            event.target.value = "";

            return;
        }


        setAvatarFile(file);
    }


    /*
     * ========================================
     * UPLOAD AVATAR
     * ========================================
     */

    async function uploadAvatar() {
        if (!avatarFile) {
            setErrorMessage(
                "Choose a profile photo first."
            );

            return;
        }


        try {
            setAvatarUploading(true);

            setMessage("");

            setErrorMessage("");


            const extension =
                avatarFile.name
                    .split(".")
                    .pop()
                    ?.toLowerCase() ||
                "jpg";


            const path =
                `${userId}/${crypto.randomUUID()}.${extension}`;


            const {
                error: uploadError,
            } =
                await supabase.storage
                    .from("avatars")
                    .upload(
                        path,
                        avatarFile,
                        {
                            cacheControl:
                                "3600",

                            upsert: false,
                        }
                    );


            if (uploadError) {
                throw uploadError;
            }


            const {
                data:
                    publicUrlData,
            } =
                supabase.storage
                    .from("avatars")
                    .getPublicUrl(path);


            const avatarUrl =
                publicUrlData.publicUrl;


            const {
                error: updateError,
            } =
                await supabase
                    .from("profiles")
                    .update({
                        avatar_url:
                        avatarUrl,
                    })
                    .eq(
                        "id",
                        userId
                    );


            if (updateError) {
                throw updateError;
            }


            setProfile(
                (
                    current
                ) => ({
                    ...current,

                    avatarUrl,
                })
            );


            setAvatarFile(null);


            setMessage(
                "Profile photo updated."
            );


            router.refresh();

        } catch (error) {
            console.warn(
                error
            );


            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not upload profile photo."
            );

        } finally {
            setAvatarUploading(
                false
            );
        }
    }


    /*
     * ========================================
     * SAVE PROFILE
     * ========================================
     */

    async function saveProfile() {
        const cleanFirstName =
            firstName.trim();

        const cleanLastName =
            lastName.trim();


        if (
            !cleanFirstName ||
            !cleanLastName
        ) {
            setErrorMessage(
                "Please enter your first and last name."
            );

            return;
        }


        try {
            setSaving(true);

            setMessage("");

            setErrorMessage("");


            const {
                error,
            } =
                await supabase
                    .from("profiles")
                    .update({
                        first_name:
                        cleanFirstName,

                        last_name:
                        cleanLastName,
                    })
                    .eq(
                        "id",
                        userId
                    );


            if (error) {
                throw error;
            }


            setProfile(
                (
                    current
                ) => ({
                    ...current,

                    firstName:
                    cleanFirstName,

                    lastName:
                    cleanLastName,
                })
            );


            /*
             * First-time onboarding:
             *
             * Save profile and continue
             * directly to Meme Lab.
             */

            if (welcome) {
                router.replace(
                    "/dashboard"
                );

                router.refresh();

                return;
            }


            setEditing(false);


            setMessage(
                "Profile updated."
            );


            router.refresh();

        } catch (error) {
            console.warn(
                error
            );


            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not save profile."
            );

        } finally {
            setSaving(false);
        }
    }


    /*
     * ========================================
     * DELETE OWN POST
     * ========================================
     */

    async function deletePost(
        postId: string
    ) {
        const confirmed =
            window.confirm(
                "Delete this post? This cannot be undone."
            );


        if (!confirmed) {
            return;
        }


        try {
            setDeletingId(
                postId
            );

            setMessage("");

            setErrorMessage("");


            const {
                error,
            } =
                await supabase
                    .from(
                        "generations"
                    )
                    .delete()
                    .eq(
                        "id",
                        postId
                    )
                    .eq(
                        "user_id",
                        userId
                    );


            if (error) {
                throw error;
            }


            setPosts(
                (
                    current
                ) =>
                    current.filter(
                        (post) =>
                            post.id !==
                            postId
                    )
            );


            setMessage(
                "Post deleted."
            );


            router.refresh();

        } catch (error) {
            console.warn(
                error
            );


            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Could not delete this post."
            );

        } finally {
            setDeletingId(
                null
            );
        }
    }


    /*
     * ========================================
     * DATE
     * ========================================
     */

    function formatDate(
        value: string
    ) {
        const date =
            new Date(value);


        return new Intl.DateTimeFormat(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year:
                    date.getUTCFullYear() !==
                    new Date().getUTCFullYear()
                        ? "numeric"
                        : undefined,

                timeZone: "UTC",
            }
        ).format(date);
    }


    return (
        <main
            className={
                styles.page
            }
        >
            {/* ======================================
          NAV
      ====================================== */}

            <header
                className={
                    styles.nav
                }
            >
                <button
                    type="button"
                    className={
                        styles.brand
                    }
                    onClick={
                        goHome
                    }
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
                    className={
                        styles.navLinks
                    }
                >
                    <button
                        type="button"
                        onClick={
                            goHome
                        }
                    >
                        Home
                    </button>

                    <button
                        type="button"
                        onClick={
                            goCreate
                        }
                    >
                        Create
                    </button>

                    <button
                        type="button"
                        onClick={
                            goExplore
                        }
                    >
                        Explore
                    </button>
                </nav>


                <div
                    className={
                        styles.navActions
                    }
                >
                    <button
                        type="button"
                        className={
                            styles.logoutButton
                        }
                        onClick={() =>
                            void handleLogout()
                        }
                    >
                        Log out
                    </button>
                </div>
            </header>


            {/* ======================================
          PROFILE HERO
      ====================================== */}

            <section
                className={
                    styles.profileHero
                }
            >
                <div
                    className={
                        styles.heroInner
                    }
                >
                    <div
                        className={
                            styles.identityBlock
                        }
                    >
                        <div
                            className={
                                styles.avatarLarge
                            }
                        >
                            {profile.avatarUrl ? (
                                <img
                                    src={
                                        profile.avatarUrl
                                    }
                                    alt={
                                        displayName
                                    }
                                />
                            ) : (
                                <span>
                  {initial}
                </span>
                            )}
                        </div>


                        <div
                            className={
                                styles.identityText
                            }
                        >
                            <p
                                className={
                                    styles.eyebrow
                                }
                            >
                                YOUR PROFILE
                            </p>


                            <h1>
                                {displayName}
                            </h1>


                            <p
                                className={
                                    styles.bio
                                }
                            >
                                Creating campus
                                chaos, one meme
                                at a time.
                            </p>


                            {!welcome && (
                                <button
                                    type="button"
                                    className={
                                        styles.editProfileButton
                                    }
                                    onClick={() => {
                                        setMessage("");

                                        setErrorMessage("");

                                        setEditing(
                                            (
                                                current
                                            ) =>
                                                !current
                                        );
                                    }}
                                >
                                    {editing
                                        ? "Close editor"
                                        : "Edit profile"}
                                </button>
                            )}
                        </div>
                    </div>


                    <div
                        className={
                            styles.stats
                        }
                    >
                        <div
                            className={
                                styles.statCard
                            }
                        >
                            <strong>
                                {
                                    posts.length
                                }
                            </strong>

                            <span>
                Posts
              </span>
                        </div>


                        <div
                            className={
                                styles.statCard
                            }
                        >
                            <strong>
                                {
                                    totalFunnyVotes
                                }
                            </strong>

                            <span>
                Funny votes
              </span>
                        </div>
                    </div>
                </div>
            </section>


            {/* ======================================
          EDIT PROFILE
      ====================================== */}

            {editing && (
                <section
                    className={
                        styles.editorSection
                    }
                >
                    <div
                        className={
                            styles.editorCard
                        }
                    >
                        <div
                            className={
                                styles.editorHeading
                            }
                        >
                            <div>
                                <p
                                    className={
                                        styles.sectionEyebrow
                                    }
                                >
                                    {welcome
                                        ? "WELCOME TO MEME LAB"
                                        : "ACCOUNT SETTINGS"}
                                </p>

                                <h2>
                                    {welcome
                                        ? "Complete your profile"
                                        : "Edit profile"}
                                </h2>

                                <p>
                                    {welcome
                                        ? "Add your name and photo before you start creating."
                                        : "Update your name or profile photo."}
                                </p>
                            </div>
                        </div>


                        <div
                            className={
                                styles.avatarEditor
                            }
                        >
                            <div
                                className={
                                    styles.avatarSmall
                                }
                            >
                                {profile.avatarUrl ? (
                                    <img
                                        src={
                                            profile.avatarUrl
                                        }
                                        alt=""
                                    />
                                ) : (
                                    <span>
                    {initial}
                  </span>
                                )}
                            </div>


                            <div
                                className={
                                    styles.avatarEditorText
                                }
                            >
                                <strong>
                                    Profile photo
                                </strong>

                                <span>
                  JPG, PNG or WEBP
                </span>
                            </div>
                        </div>


                        <div
                            className={
                                styles.fileRow
                            }
                        >
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={
                                    handleAvatarFileChange
                                }
                            />


                            <button
                                type="button"
                                disabled={
                                    !avatarFile ||
                                    avatarUploading
                                }
                                onClick={() =>
                                    void uploadAvatar()
                                }
                            >
                                {avatarUploading
                                    ? "Uploading..."
                                    : "Upload photo"}
                            </button>
                        </div>


                        <label
                            className={
                                styles.field
                            }
                        >
              <span>
                EMAIL
              </span>

                            <input
                                type="email"
                                value={
                                    email
                                }
                                disabled
                            />
                        </label>


                        <div
                            className={
                                styles.nameGrid
                            }
                        >
                            <label
                                className={
                                    styles.field
                                }
                            >
                <span>
                  FIRST NAME
                </span>

                                <input
                                    type="text"
                                    value={
                                        firstName
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setFirstName(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                />
                            </label>


                            <label
                                className={
                                    styles.field
                                }
                            >
                <span>
                  LAST NAME
                </span>

                                <input
                                    type="text"
                                    value={
                                        lastName
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setLastName(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                />
                            </label>
                        </div>


                        {errorMessage && (
                            <p
                                className={
                                    styles.errorMessage
                                }
                            >
                                {errorMessage}
                            </p>
                        )}


                        {message && (
                            <p
                                className={
                                    styles.successMessage
                                }
                            >
                                {message}
                            </p>
                        )}


                        <button
                            type="button"
                            className={
                                styles.saveButton
                            }
                            disabled={
                                saving
                            }
                            onClick={() =>
                                void saveProfile()
                            }
                        >
                            {saving
                                ? "Saving..."
                                : welcome
                                    ? "Save and continue"
                                    : "Save changes"}
                        </button>
                    </div>
                </section>
            )}


            {/* ======================================
          POSTS
      ====================================== */}

            <section
                className={
                    styles.postsSection
                }
            >
                <div
                    className={
                        styles.postsHeader
                    }
                >
                    <div>
                        <p
                            className={
                                styles.sectionEyebrow
                            }
                        >
                            CREATIONS
                        </p>

                        <h2>
                            Posts
                        </h2>
                    </div>


                    <span
                        className={
                            styles.postCount
                        }
                    >
            {
                posts.length
            }{" "}
                        {posts.length === 1
                            ? "post"
                            : "posts"}
          </span>
                </div>


                {posts.length === 0 ? (
                    <div
                        className={
                            styles.emptyState
                        }
                    >
                        <h3>
                            No memes yet.
                        </h3>

                        <p>
                            Create your first
                            AI-generated meme.
                        </p>

                        <button
                            type="button"
                            onClick={
                                goCreate
                            }
                        >
                            Create a meme
                        </button>
                    </div>
                ) : (
                    <div
                        className={
                            styles.postsGrid
                        }
                    >
                        {posts.map(
                            (
                                post
                            ) => (
                                <article
                                    key={
                                        post.id
                                    }
                                    className={
                                        styles.postCard
                                    }
                                >
                                    <Link
                                        href={`/meme/${post.id}`}
                                        className={
                                            styles.postImageLink
                                        }
                                    >
                                        <div
                                            className={
                                                styles.postImage
                                            }
                                        >
                                            <img
                                                src={
                                                    post.image_url
                                                }
                                                alt={
                                                    post.caption
                                                }
                                            />
                                        </div>
                                    </Link>


                                    <div
                                        className={
                                            styles.postBody
                                        }
                                    >
                                        <Link
                                            href={`/meme/${post.id}`}
                                            className={
                                                styles.captionLink
                                            }
                                        >
                                            <h3>
                                                {
                                                    post.caption
                                                }
                                            </h3>
                                        </Link>


                                        <p
                                            className={
                                                styles.prompt
                                            }
                                        >
                                            Prompt:{" "}
                                            {
                                                post.prompt
                                            }
                                        </p>


                                        <div
                                            className={
                                                styles.postMeta
                                            }
                                        >
                      <span>
                        {formatDate(
                            post.created_at
                        )}
                      </span>

                                            <span>
                        Score{" "}
                                                {
                                                    post.score
                                                }
                      </span>
                                        </div>


                                        <div
                                            className={
                                                styles.voteSummary
                                            }
                                        >
                                            <div>
                        <span>
                          ↑
                        </span>

                                                <strong>
                                                    {
                                                        post.funnyCount
                                                    }
                                                </strong>

                                                <small>
                                                    Funny
                                                </small>
                                            </div>


                                            <div>
                        <span>
                          ↓
                        </span>

                                                <strong>
                                                    {
                                                        post.notFunnyCount
                                                    }
                                                </strong>

                                                <small>
                                                    Not Funny
                                                </small>
                                            </div>
                                        </div>


                                        <button
                                            type="button"
                                            className={
                                                styles.deleteButton
                                            }
                                            disabled={
                                                deletingId ===
                                                post.id
                                            }
                                            onClick={() =>
                                                void deletePost(
                                                    post.id
                                                )
                                            }
                                        >
                                            {deletingId ===
                                            post.id
                                                ? "Deleting..."
                                                : "Delete post"}
                                        </button>
                                    </div>
                                </article>
                            )
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}