"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ProfileFormProps = {
    userId: string;
    email: string;
    initialFirstName: string;
    initialLastName: string;
    initialAvatarUrl: string | null;
};

export default function ProfileForm({
                                        userId,
                                        email,
                                        initialFirstName,
                                        initialLastName,
                                        initialAvatarUrl,
                                    }: ProfileFormProps) {
    const supabase = createClient();

    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [message, setMessage] = useState("");
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const profileIncomplete =
        firstName.trim() === "" || lastName.trim() === "";

    async function uploadAvatar() {
        if (!selectedFile) {
            setMessage("Please choose an image first.");
            return;
        }

        setUploading(true);
        setMessage("Uploading photo...");

        const fileExt = selectedFile.name
            .split(".")
            .pop()
            ?.toLowerCase();

        if (!fileExt) {
            setUploading(false);
            setMessage("Could not determine the image file type.");
            return;
        }

        const filePath = `${userId}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, selectedFile, {
                upsert: true,
                contentType: selectedFile.type,
            });

        if (uploadError) {
            setUploading(false);
            setMessage(uploadError.message);
            return;
        }

        const {
            data: { publicUrl },
        } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const avatarUrlWithCacheBust =
            `${publicUrl}?t=${Date.now()}`;

        setAvatarUrl(avatarUrlWithCacheBust);

        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                avatar_url: avatarUrlWithCacheBust,
            })
            .eq("id", userId);

        setUploading(false);

        if (profileError) {
            setMessage(profileError.message);
            return;
        }

        setSelectedFile(null);
        setMessage("Photo uploaded.");
    }

    async function saveProfile() {
        setSaving(true);
        setMessage("Saving profile...");

        const { error } = await supabase
            .from("profiles")
            .update({
                first_name: firstName,
                last_name: lastName,
                avatar_url: avatarUrl,
            })
            .eq("id", userId);

        setSaving(false);

        if (error) {
            setMessage(error.message);
            return;
        }

        setMessage("Profile saved.");
    }

    return (
        <div
            style={{
                width: "100%",
                maxWidth: "520px",
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "24px",
                padding: "40px",
                boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
                backdropFilter: "blur(16px)",
            }}
        >
            {/* Avatar */}
            <div
                style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "20px",
                    background: "white",
                    color: "black",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "26px",
                    fontWeight: "700",
                    marginBottom: "28px",
                    overflow: "hidden",
                }}
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Profile avatar"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    email.charAt(0).toUpperCase()
                )}
            </div>

            {/* Title */}
            <h1
                style={{
                    fontSize: "32px",
                    margin: 0,
                    fontWeight: "600",
                    letterSpacing: "-0.8px",
                }}
            >
                Your profile
            </h1>

            <p
                style={{
                    marginTop: "12px",
                    marginBottom: "24px",
                    color: "#9ca3af",
                    lineHeight: "1.6",
                }}
            >
                Update your personal information and profile photo.
            </p>

            {/* Incomplete profile prompt */}
            {profileIncomplete && (
                <div
                    style={{
                        marginBottom: "24px",
                        padding: "16px",
                        borderRadius: "14px",
                        background: "rgba(255, 190, 70, 0.08)",
                        border:
                            "1px solid rgba(255, 190, 70, 0.25)",
                        color: "#f3d08a",
                        fontSize: "14px",
                        lineHeight: "1.5",
                    }}
                >
                    Your profile is incomplete. Please enter your first
                    and last name.
                </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: "18px" }}>
                <label
                    style={{
                        display: "block",
                        marginBottom: "8px",
                        color: "#8b8b8b",
                        fontSize: "13px",
                    }}
                >
                    EMAIL
                </label>

                <input
                    value={email}
                    disabled
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "rgba(255,255,255,0.04)",
                        border:
                            "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        padding: "14px",
                        color: "#888",
                        fontSize: "16px",
                    }}
                />
            </div>

            {/* Name fields */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "14px",
                }}
            >
                <div>
                    <label
                        style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#8b8b8b",
                            fontSize: "13px",
                        }}
                    >
                        FIRST NAME
                    </label>

                    <input
                        value={firstName}
                        onChange={(e) =>
                            setFirstName(e.target.value)
                        }
                        placeholder="First name"
                        style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background:
                                "rgba(255,255,255,0.04)",
                            border:
                                "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "14px",
                            padding: "14px",
                            color: "white",
                            fontSize: "16px",
                            outline: "none",
                        }}
                    />
                </div>

                <div>
                    <label
                        style={{
                            display: "block",
                            marginBottom: "8px",
                            color: "#8b8b8b",
                            fontSize: "13px",
                        }}
                    >
                        LAST NAME
                    </label>

                    <input
                        value={lastName}
                        onChange={(e) =>
                            setLastName(e.target.value)
                        }
                        placeholder="Last name"
                        style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background:
                                "rgba(255,255,255,0.04)",
                            border:
                                "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "14px",
                            padding: "14px",
                            color: "white",
                            fontSize: "16px",
                            outline: "none",
                        }}
                    />
                </div>
            </div>

            {/* Photo upload */}
            <div style={{ marginTop: "24px" }}>
                <label
                    style={{
                        display: "block",
                        marginBottom: "10px",
                        color: "#8b8b8b",
                        fontSize: "13px",
                    }}
                >
                    PROFILE PHOTO
                </label>

                <label
                    htmlFor="avatar-upload"
                    style={{
                        width: "100%",
                        boxSizing: "border-box",
                        minHeight: "110px",
                        borderRadius: "16px",
                        border:
                            "1px dashed rgba(255,255,255,0.22)",
                        background:
                            "rgba(255,255,255,0.035)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: "8px",
                        cursor: "pointer",
                    }}
                >
                    <div
                        style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "12px",
                            background:
                                "rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "24px",
                        }}
                    >
                        +
                    </div>

                    <div
                        style={{
                            color: "white",
                            fontSize: "15px",
                            fontWeight: "600",
                        }}
                    >
                        Choose profile photo
                    </div>

                    <div
                        style={{
                            color: "#7f8793",
                            fontSize: "12px",
                        }}
                    >
                        JPG, PNG, WEBP, or other image files
                    </div>
                </label>

                <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                        setSelectedFile(
                            e.target.files?.[0] ?? null
                        )
                    }
                    style={{
                        display: "none",
                    }}
                />

                {selectedFile && (
                    <div
                        style={{
                            marginTop: "12px",
                            padding: "12px 14px",
                            borderRadius: "12px",
                            background:
                                "rgba(255,255,255,0.04)",
                            border:
                                "1px solid rgba(255,255,255,0.08)",
                            color: "#c7cbd1",
                            fontSize: "13px",
                            wordBreak: "break-word",
                        }}
                    >
                        Selected: {selectedFile.name}
                    </div>
                )}

                <button
                    type="button"
                    onClick={uploadAvatar}
                    disabled={uploading || !selectedFile}
                    style={{
                        width: "100%",
                        marginTop: "14px",
                        height: "48px",
                        borderRadius: "12px",
                        border:
                            "1px solid rgba(255,255,255,0.12)",
                        background:
                            uploading || !selectedFile
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(255,255,255,0.1)",
                        color:
                            uploading || !selectedFile
                                ? "#666"
                                : "white",
                        fontSize: "15px",
                        fontWeight: "500",
                        cursor:
                            uploading || !selectedFile
                                ? "not-allowed"
                                : "pointer",
                    }}
                >
                    {uploading
                        ? "Uploading..."
                        : "Upload photo"}
                </button>
            </div>

            {/* Save button */}
            <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                style={{
                    width: "100%",
                    marginTop: "24px",
                    height: "52px",
                    borderRadius: "14px",
                    border: "none",
                    background: saving
                        ? "#d1d1d1"
                        : "white",
                    color: "#111",
                    fontSize: "16px",
                    fontWeight: "600",
                    cursor: saving
                        ? "not-allowed"
                        : "pointer",
                }}
            >
                {saving ? "Saving..." : "Save changes"}
            </button>

            {/* Dashboard button */}
            <a
                href="/dashboard"
                style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "14px",
                    padding: "15px",
                    borderRadius: "14px",
                    border:
                        "1px solid rgba(255,255,255,0.12)",
                    background:
                        "rgba(255,255,255,0.06)",
                    color: "white",
                    textAlign: "center",
                    textDecoration: "none",
                    fontSize: "15px",
                    fontWeight: "600",
                }}
            >
                Go to Dashboard →
            </a>

            {/* Status message */}
            {message && (
                <p
                    style={{
                        marginTop: "16px",
                        marginBottom: 0,
                        textAlign: "center",
                        color: "#9ca3af",
                        fontSize: "14px",
                    }}
                >
                    {message}
                </p>
            )}
        </div>
    );
}