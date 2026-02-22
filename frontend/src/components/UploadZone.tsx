"use client";

import { useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadReceipt, type UploadProgress } from "@/lib/storage";

export default function UploadZone() {
    const [isDragging, setIsDragging] = useState(false);
    const [uploads, setUploads] = useState<
        { id: string; name: string; progress: UploadProgress }[]
    >([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((files: FileList | File[]) => {
        Array.from(files).forEach((file) => {
            if (!file.type.startsWith("image/")) return;

            const id = `${Date.now()}_${file.name}`;
            setUploads((prev) => [
                ...prev,
                { id, name: file.name, progress: { progress: 0, state: "running" } },
            ]);

            uploadReceipt(file, (progress) => {
                setUploads((prev) =>
                    prev.map((u) => (u.id === id ? { ...u, progress } : u))
                );
            }).catch(() => {
                setUploads((prev) =>
                    prev.map((u) =>
                        u.id === id
                            ? { ...u, progress: { progress: 0, state: "error" as const } }
                            : u
                    )
                );
            });
        });
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
    );

    return (
        <div>
            {/* Drop Zone */}
            <div
                className={`dropzone ${isDragging ? "active" : ""}`}
                style={{
                    padding: "64px 32px",
                    textAlign: "center" as const,
                    cursor: "pointer",
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />

                <motion.div
                    animate={{ y: isDragging ? -8 : 0 }}
                    style={{ fontSize: 48, marginBottom: 16 }}
                >
                    📸
                </motion.div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 8 }}>
                    Drop receipt photos here
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                    or click to browse · Supports JPG, PNG, HEIC
                </div>
            </div>

            {/* Upload Progress */}
            <AnimatePresence>
                {uploads.length > 0 && (
                    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                        {uploads.map((upload) => (
                            <motion.div
                                key={upload.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="glass-card"
                                style={{ padding: "16px 20px" }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: "#f1f5f9",
                                            fontWeight: 500,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap" as const,
                                            maxWidth: "70%",
                                        }}
                                    >
                                        {upload.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color:
                                                upload.progress.state === "success"
                                                    ? "#10b981"
                                                    : upload.progress.state === "error"
                                                        ? "#ef4444"
                                                        : "#06b6d4",
                                        }}
                                    >
                                        {upload.progress.state === "success"
                                            ? "✓ Uploaded"
                                            : upload.progress.state === "error"
                                                ? "✗ Failed"
                                                : `${Math.round(upload.progress.progress)}%`}
                                    </span>
                                </div>
                                {/* Progress bar */}
                                <div
                                    style={{
                                        height: 4,
                                        borderRadius: 2,
                                        background: "rgba(255,255,255,0.06)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${upload.progress.progress}%` }}
                                        style={{
                                            height: "100%",
                                            borderRadius: 2,
                                            background:
                                                upload.progress.state === "success"
                                                    ? "#10b981"
                                                    : upload.progress.state === "error"
                                                        ? "#ef4444"
                                                        : "linear-gradient(90deg, #06b6d4, #3b82f6)",
                                        }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
