"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "./StatusBadge";
import { deleteReceipt, type Receipt } from "@/lib/firestore";

function ImageLightbox({
    src,
    alt,
    onClose,
}: {
    src: string;
    alt: string;
    onClose: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                background: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "zoom-out",
                padding: 24,
            }}
        >
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(15, 23, 42, 0.8)",
                    color: "#f1f5f9",
                    fontSize: 18,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)",
                    transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(15, 23, 42, 0.8)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                }}
            >
                ✕
            </button>

            <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                src={src}
                alt={alt}
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: "90vw",
                    maxHeight: "90vh",
                    objectFit: "contain",
                    borderRadius: 16,
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
                    cursor: "default",
                }}
            />
        </motion.div>
    );
}

export default function ReceiptCard({
    receipt,
    index,
}: {
    receipt: Receipt;
    index: number;
}) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const merchantName = receipt.store || receipt.original_filename || "Receipt";
    const initials = getInitials(merchantName);
    const hasImage = !!receipt.image_url;

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteReceipt(receipt);
        } catch (err) {
            console.error("Failed to delete receipt:", err);
            alert("Failed to delete receipt. Please try again.");
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
                className="glass-card"
                style={{
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    cursor: "default",
                    position: "relative",
                    overflow: "hidden",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    background: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(12px)",
                    borderRadius: "24px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                whileHover={{
                    y: -4,
                    borderColor: "rgba(6, 182, 212, 0.3)",
                    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(6, 182, 212, 0.1)",
                    background: "rgba(15, 23, 42, 0.8)",
                }}
            >
                {/* Image thumbnail */}
                {hasImage && (
                    <div
                        onClick={() => setLightboxOpen(true)}
                        style={{
                            width: "100%",
                            height: 160,
                            position: "relative",
                            cursor: "zoom-in",
                            overflow: "hidden",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        }}
                    >
                        <img
                            src={receipt.image_url}
                            alt={`Receipt from ${merchantName}`}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transition: "transform 0.3s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        />
                        <div
                            style={{
                                position: "absolute",
                                bottom: 8,
                                right: 8,
                                width: 32,
                                height: 32,
                                borderRadius: "10px",
                                background: "rgba(0, 0, 0, 0.6)",
                                backdropFilter: "blur(8px)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 14,
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                            }}
                        >
                            🔍
                        </div>
                    </div>
                )}

                {/* Card content */}
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Top Row: Merchant & Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: "16px",
                                    background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: "#06b6d4",
                                    border: "1px solid rgba(6, 182, 212, 0.2)",
                                    boxShadow: "inset 0 0 10px rgba(6, 182, 212, 0.1)",
                                    flexShrink: 0,
                                }}
                            >
                                {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        color: "#f8fafc",
                                        marginBottom: 4,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                    title={merchantName}
                                >
                                    {merchantName}
                                </h3>
                                <div style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                                    <span>📅</span>
                                    {receipt.date || "Pending..."}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <StatusBadge status={receipt.status} />
                        </div>
                    </div>

                    {/* Middle Row: Category & Amount */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            paddingTop: 8,
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                Category
                            </span>
                            <span
                                style={{
                                    fontSize: 13,
                                    color: "#cbd5e1",
                                    background: "rgba(30, 41, 59, 0.5)",
                                    padding: "6px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid rgba(255, 255, 255, 0.05)",
                                    width: "fit-content"
                                }}
                            >
                                {receipt.category || "Uncategorized"}
                            </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                                Amount
                            </span>
                            <div
                                style={{
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: "#f1f5f9",
                                    letterSpacing: "-0.03em",
                                    textShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
                                }}
                            >
                                {receipt.amount ? `$${receipt.amount.toFixed(2)}` : "—"}
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {receipt.error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            style={{
                                fontSize: 12,
                                color: "#fca5a5",
                                background: "rgba(239, 68, 68, 0.1)",
                                padding: "10px 14px",
                                borderRadius: "12px",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                marginTop: 4,
                            }}
                        >
                            <span style={{ marginRight: 6 }}>⚠️</span>
                            {receipt.error}
                        </motion.div>
                    )}

                    {/* Delete Section */}
                    <AnimatePresence mode="wait">
                        {confirmDelete ? (
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{
                                    background: "rgba(239, 68, 68, 0.08)",
                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                    borderRadius: 14,
                                    padding: "14px 16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                }}
                            >
                                <span style={{ fontSize: 13, color: "#fca5a5", fontWeight: 500 }}>
                                    Delete this receipt?
                                </span>
                                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        disabled={deleting}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: 10,
                                            border: "1px solid rgba(255, 255, 255, 0.1)",
                                            background: "rgba(255, 255, 255, 0.05)",
                                            color: "#94a3b8",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: deleting ? "not-allowed" : "pointer",
                                            transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!deleting) e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        style={{
                                            padding: "6px 14px",
                                            borderRadius: 10,
                                            border: "1px solid rgba(239, 68, 68, 0.4)",
                                            background: deleting ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.2)",
                                            color: "#fca5a5",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: deleting ? "not-allowed" : "pointer",
                                            transition: "all 0.2s ease",
                                            opacity: deleting ? 0.6 : 1,
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!deleting) e.currentTarget.style.background = "rgba(239, 68, 68, 0.35)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = deleting ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.2)";
                                        }}
                                    >
                                        {deleting ? "Deleting..." : "Delete"}
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.button
                                key="delete-btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setConfirmDelete(true)}
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255, 255, 255, 0.04)",
                                    background: "rgba(255, 255, 255, 0.02)",
                                    color: "#64748b",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                                    e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
                                    e.currentTarget.style.color = "#fca5a5";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.04)";
                                    e.currentTarget.style.color = "#64748b";
                                }}
                            >
                                🗑️ Delete Receipt
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Glow Effect */}
                <div
                    style={{
                        position: "absolute",
                        top: "-20%",
                        right: "-20%",
                        width: "40%",
                        height: "40%",
                        background: "radial-gradient(circle, rgba(6, 182, 212, 0.05) 0%, transparent 70%)",
                        pointerEvents: "none",
                    }}
                />
            </motion.div>

            {/* Lightbox */}
            <AnimatePresence>
                {lightboxOpen && hasImage && (
                    <ImageLightbox
                        src={receipt.image_url!}
                        alt={`Receipt from ${merchantName}`}
                        onClose={() => setLightboxOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
