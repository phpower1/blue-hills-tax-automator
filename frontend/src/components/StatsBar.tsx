"use client";

import { motion } from "framer-motion";
import type { Receipt } from "@/lib/firestore";

interface Stat {
    label: string;
    value: string;
    icon: string;
    color: string;
}

export default function StatsBar({ receipts }: { receipts: Receipt[] }) {
    const total = receipts.length;
    const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const completed = receipts.filter((r) => r.status === "completed").length;
    const processing = receipts.filter((r) => r.status === "processing").length;

    const stats: Stat[] = [
        {
            label: "Total Receipts",
            value: total.toString(),
            icon: "🧾",
            color: "#06b6d4",
        },
        {
            label: "Total Amount",
            value: `$${totalAmount.toFixed(2)}`,
            icon: "💰",
            color: "#10b981",
        },
        {
            label: "Processed",
            value: completed.toString(),
            icon: "✅",
            color: "#34d399",
        },
        {
            label: "Processing",
            value: processing.toString(),
            icon: "⏳",
            color: "#f59e0b",
        },
    ];

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 32,
            }}
        >
            {stats.map((stat, i) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="glass-card"
                    style={{ padding: "20px 24px" }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                        }}
                    >
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                            {stat.label}
                        </span>
                        <span style={{ fontSize: 20 }}>{stat.icon}</span>
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: stat.color,
                            letterSpacing: "-0.03em",
                        }}
                    >
                        {stat.value}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
