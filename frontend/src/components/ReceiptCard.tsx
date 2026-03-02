"use client";

import { motion } from "framer-motion";
import StatusBadge from "./StatusBadge";
import type { Receipt } from "@/lib/firestore";

export default function ReceiptCard({
    receipt,
    index,
}: {
    receipt: Receipt;
    index: number;
}) {
    // Get merchant initials for the icon
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
            className="glass-card"
            style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
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
            {/* Top Row: Merchant & Status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
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
                <StatusBadge status={receipt.status} />
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
    );
}
