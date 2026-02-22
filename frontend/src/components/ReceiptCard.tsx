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
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="glass-card"
            style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                cursor: "default",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
            whileHover={{
                borderColor: "rgba(6, 182, 212, 0.2)",
                boxShadow: "0 0 20px rgba(6, 182, 212, 0.08)",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#f1f5f9",
                            marginBottom: 2,
                        }}
                    >
                        {receipt.store || receipt.original_filename || "Receipt"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                        {receipt.date || receipt.id.slice(0, 20)}
                    </div>
                </div>
                <StatusBadge status={receipt.status} />
            </div>

            {/* Details */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    {receipt.category && (
                        <span
                            style={{
                                fontSize: 12,
                                color: "#94a3b8",
                                background: "rgba(148, 163, 184, 0.08)",
                                padding: "3px 10px",
                                borderRadius: 8,
                            }}
                        >
                            {receipt.category}
                        </span>
                    )}
                </div>
                {receipt.amount ? (
                    <div
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: "#f1f5f9",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        ${receipt.amount.toFixed(2)}
                    </div>
                ) : null}
            </div>

            {/* Error */}
            {receipt.error && (
                <div
                    style={{
                        fontSize: 12,
                        color: "#f87171",
                        background: "rgba(239, 68, 68, 0.08)",
                        padding: "8px 12px",
                        borderRadius: 8,
                    }}
                >
                    {receipt.error}
                </div>
            )}
        </motion.div>
    );
}
