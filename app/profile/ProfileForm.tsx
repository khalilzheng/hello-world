"use client";

import type {
    ChangeEvent,
} from "react";

import {
    useMemo,
    useState,
} from "react";

import { createClient } from "@/utils/supabase/client";
import styles from "./ProfileForm.module.css";

type Props = {
    userId: string;
    email: string;

    initialFirstName: string;
    initialLastName: string;
    initialAvatarUrl: string;
};

const MAX_AVATAR_SIZE =
    5 * 1024 * 1024;

export default function ProfileForm({
                                        userId,
                                        email,
                                        initialFirstName,
                                        initialLastName,
                                        initialAvatarUrl,
                                    }: Props) {
    const supabase =
        useMemo(
            () =>
                createClient(),
            []
        );

    const [
        firstName,
        setFirstName,
    ] =
        useState(
            initialFirstName
        );

    const [
        lastName,
        setLastName,
    ] =
        useState(
            initialLastName
        );

    const [
        avatarUrl,
        setAvatarUrl,
    ] =
        useState(
            initialAvatarUrl
        );

    const [
        avatarFile,
        setAvatarFile,
    ] =
        useState<File | null>(
            null
        );

    const [
        uploading,
        setUploading,
    ] =
        useState(false);

    const [
        saving,
        setSaving,
    ] =
        useState(false);

    const [
        message,
        setMessage,
    ] =
        useState("");

    const initials =
        `${
            firstName
                .trim()
                .charAt(0)
        }${
            lastName
                .trim()
                .charAt(0)
        }`.toUpperCase() ||
        "M";

    function handlePhotoChange(
        event: ChangeEvent<HTMLInputElement>
    ) {
        const file =
            event.target.files?.[0] ??
            null;

        if (!file) {
            return;
        }

        if (
            ![
                "image/png",
                "image/jpeg",
                "image/webp",
            ].includes(
                file.type
            )
        ) {
            setMessage(
                "Choose a JPG, PNG, or WEBP image."
            );

            return;
        }

        if (
            file.size >
            MAX_AVATAR_SIZE
        ) {
            setMessage(
                "Profile photo must be smaller than 5 MB."
            );

            return;
        }

        setAvatarFile(
            file
        );

        setMessage("");
    }

    async function uploadPhoto() {
        if (!avatarFile) {
            setMessage(
                "Choose a profile photo first."
            );

            return;
        }

        try {
            setUploading(
                true
            );

            setMessage("");

            const extension =
                avatarFile.name
                    .split(".")
                    .pop()
                    ?.toLowerCase() ||
                "jpg";

            const path =
                `${userId}/${crypto.randomUUID()}.${extension}`;

            const {
                error:
                    uploadError,
            } =
                await supabase.storage
                    .from("avatars")
                    .upload(
                        path,
                        avatarFile,
                        {
                            contentType:
                            avatarFile.type,

                            upsert:
                                false,
                        }
                    );

            if (
                uploadError
            ) {
                throw uploadError;
            }

            const {
                data,
            } =
                supabase.storage
                    .from("avatars")
                    .getPublicUrl(
                        path
                    );

            const url =
                data.publicUrl;

            const {
                error:
                    profileError,
            } =
                await supabase
                    .from("profiles")
                    .update({
                        avatar_url:
                        url,
                    })
                    .eq(
                        "id",
                        userId
                    );

            if (
                profileError
            ) {
                throw profileError;
            }

            setAvatarUrl(
                url
            );

            setAvatarFile(
                null
            );

            setMessage(
                "Profile photo updated."
            );
        } catch (
            error
            ) {
            console.warn(
                error
            );

            setMessage(
                "Could not upload profile photo."
            );
        } finally {
            setUploading(
                false
            );
        }
    }

    async function saveProfile() {
        try {
            setSaving(
                true
            );

            setMessage("");

            const {
                error,
            } =
                await supabase
                    .from("profiles")
                    .update({
                        first_name:
                            firstName.trim(),

                        last_name:
                            lastName.trim(),
                    })
                    .eq(
                        "id",
                        userId
                    );

            if (error) {
                throw error;
            }

            setMessage(
                "Profile saved."
            );
        } catch (
            error
            ) {
            console.warn(
                error
            );

            setMessage(
                "Could not save profile."
            );
        } finally {
            setSaving(
                false
            );
        }
    }

    return (
        <main
            className={
                styles.page
            }
        >
            <section
                className={
                    styles.hero
                }
            >
                <p>
                    YOUR ACCOUNT
                </p>

                <h1>
                    Profile
                </h1>

                <span>
          Keep your identity simple.
          Your memes do the talking.
        </span>
            </section>

            <section
                className={
                    styles.content
                }
            >
                <div
                    className={
                        styles.card
                    }
                >
                    <div
                        className={
                            styles.photoHeader
                        }
                    >
                        {avatarUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={
                                    avatarUrl
                                }
                                alt="Profile"
                                className={
                                    styles.avatar
                                }
                            />
                        ) : (
                            <div
                                className={
                                    styles.avatarFallback
                                }
                            >
                                {initials}
                            </div>
                        )}

                        <div>
                            <h2>
                                Profile photo
                            </h2>

                            <p>
                                JPG, PNG or WEBP.
                            </p>
                        </div>
                    </div>

                    <div
                        className={
                            styles.uploadRow
                        }
                    >
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={
                                handlePhotoChange
                            }
                        />

                        <button
                            type="button"
                            disabled={
                                uploading ||
                                !avatarFile
                            }
                            onClick={() =>
                                void uploadPhoto()
                            }
                        >
                            {uploading
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
                            value={email}
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
                                value={
                                    firstName
                                }
                                onChange={(
                                    event
                                ) =>
                                    setFirstName(
                                        event.target.value
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
                                value={
                                    lastName
                                }
                                onChange={(
                                    event
                                ) =>
                                    setLastName(
                                        event.target.value
                                    )
                                }
                            />
                        </label>
                    </div>

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
                            : "Save changes"}
                    </button>

                    {message && (
                        <p
                            className={
                                styles.message
                            }
                        >
                            {message}
                        </p>
                    )}
                </div>
            </section>
        </main>
    );
}