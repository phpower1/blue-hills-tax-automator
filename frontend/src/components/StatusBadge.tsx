"use client";

import { motion } from "framer-motion";

type Status = "new" | "processing" | "completed" | "failed" | string;

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
    new: {
        bg: "rgba(59, 130, 246, 0.12)",
        text: "#60a5fa",
        dot: "#3b82f6",
    },
    processing: {
        bg: "rgba(245, 158, 11, 0.12)",
        text: "#fbbf24",
        dot: "#f59e0b",
    },
    completed: {
        bg: "rgba(16, 185, 129, 0.12)",
        text: "#34d399",
        dot: "#10b981",
    },
    failed: {
        bg: "rgba(239, 68, 68, 0.12)",
        text: "#f87171",
        dot: "#ef4444",
    },
};

export default function StatusBadge({ status }: { status: Status }) {
    const style = statusStyles[status] ?? statusStyles.new;

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                textTransform: "capitalize",
                background: style.bg,
                color: style.text,
            }}
        >
            <motion.span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: style.dot,
                    display: "inline-block",
                }}
                animate={
                    status === "processing"
                        ? { opacity: [1, 0.3, 1] }
                        : {}
                }
                transition={
                    status === "processing"
                        ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                        : {}
                }
            />
            {status}
        </span>
    );
}
