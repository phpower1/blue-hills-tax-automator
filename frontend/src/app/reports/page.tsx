"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { subscribeToReceipts, type Receipt } from "@/lib/firestore";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/components/AuthProvider";

export default function ReportsPage() {
    const { user } = useAuth();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const unsub = subscribeToReceipts(user.uid, (data) => {
            setReceipts(data);
            setLoading(false);
        });
        return unsub;
    }, [user]);

    const completed = receipts.filter((r) => r.status === "completed");

    // Group by category
    const byCategory = completed.reduce<Record<string, { count: number; total: number }>>(
        (acc, r) => {
            const cat = r.category || "Uncategorized";
            if (!acc[cat]) acc[cat] = { count: 0, total: 0 };
            acc[cat].count += 1;
            acc[cat].total += r.amount || 0;
            return acc;
        },
        {}
    );

    const exportCSV = () => {
        const headers = ["ID", "Store", "Date", "Amount", "Category", "Status"];
        const rows = completed.map((r) => [
            r.id,
            r.store || "",
            r.date || "",
            (r.amount || 0).toFixed(2),
            r.category || "",
            r.status,
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tax-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 32,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                            marginBottom: 6,
                        }}
                    >
                        Reports
                    </h1>
                    <p style={{ fontSize: 14, color: "#64748b" }}>
                        View processed receipts and export for your accountant
                    </p>
                </div>
                <button
                    onClick={exportCSV}
                    disabled={completed.length === 0}
                    style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: completed.length ? "pointer" : "not-allowed",
                        background:
                            completed.length > 0
                                ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
                                : "rgba(255,255,255,0.06)",
                        color: completed.length > 0 ? "#fff" : "#64748b",
                        transition: "all 0.2s ease",
                    }}
                >
                    📥 Export CSV
                </button>
            </div>

            {/* Category Summary */}
            <div style={{ marginBottom: 32 }}>
                <h2
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#94a3b8",
                        marginBottom: 16,
                    }}
                >
                    Category Breakdown
                </h2>
                {Object.keys(byCategory).length > 0 ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: 12,
                        }}
                    >
                        {Object.entries(byCategory).map(([cat, data], i) => (
                            <motion.div
                                key={cat}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="glass-card"
                                style={{ padding: "16px 20px" }}
                            >
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#f1f5f9",
                                        marginBottom: 8,
                                    }}
                                >
                                    {cat}
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>
                                        {data.count} receipt{data.count !== 1 ? "s" : ""}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: "#06b6d4",
                                        }}
                                    >
                                        ${data.total.toFixed(2)}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div
                        className="glass-card"
                        style={{
                            padding: 32,
                            textAlign: "center",
                            color: "#64748b",
                        }}
                    >
                        No completed receipts yet
                    </div>
                )}
            </div>

            {/* Table */}
            <div style={{ marginBottom: 32 }}>
                <h2
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#94a3b8",
                        marginBottom: 16,
                    }}
                >
                    All Receipts
                </h2>

                {loading ? (
                    <div style={{ color: "#64748b", textAlign: "center", padding: 32 }}>
                        Loading...
                    </div>
                ) : receipts.length === 0 ? (
                    <div
                        className="glass-card"
                        style={{ padding: 32, textAlign: "center", color: "#64748b" }}
                    >
                        No receipts found
                    </div>
                ) : (
                    <div
                        className="glass-card"
                        style={{ overflow: "auto", borderRadius: 16 }}
                    >
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 13,
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    {["Store", "Date", "Amount", "Category", "Status"].map(
                                        (h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    padding: "14px 20px",
                                                    textAlign: "left",
                                                    fontWeight: 600,
                                                    color: "#64748b",
                                                    fontSize: 11,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.06em",
                                                }}
                                            >
                                                {h}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {receipts.map((r) => (
                                    <tr
                                        key={r.id}
                                        style={{
                                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                                        }}
                                    >
                                        <td style={{ padding: "14px 20px", color: "#f1f5f9" }}>
                                            {r.store || r.original_filename || r.id.slice(0, 16)}
                                        </td>
                                        <td style={{ padding: "14px 20px", color: "#94a3b8" }}>
                                            {r.date || "—"}
                                        </td>
                                        <td
                                            style={{
                                                padding: "14px 20px",
                                                color: "#f1f5f9",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {r.amount ? `$${r.amount.toFixed(2)}` : "—"}
                                        </td>
                                        <td style={{ padding: "14px 20px", color: "#94a3b8" }}>
                                            {r.category || "—"}
                                        </td>
                                        <td style={{ padding: "14px 20px" }}>
                                            <StatusBadge status={r.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
