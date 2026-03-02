"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToReceipts, type Receipt } from "@/lib/firestore";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/components/AuthProvider";

export default function ReportsPage() {
    const { user } = useAuth();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [showYearModal, setShowYearModal] = useState(false);
    const [selectedYear, setSelectedYear] = useState<string>("all");

    useEffect(() => {
        if (!user) return;

        const unsub = subscribeToReceipts(user.uid, (data) => {
            setReceipts(data);
            setLoading(false);
        });
        return unsub;
    }, [user]);

    // Include "completed", "processed", and "needs_approval" statuses for exports/reports
    const exportable = receipts.filter((r) =>
        ["completed", "processed", "needs_approval"].includes(r.status)
    );

    // Group by category
    const byCategory = exportable.reduce<Record<string, { count: number; total: number }>>(
        (acc, r) => {
            const cat = r.category || "Uncategorized";
            if (!acc[cat]) acc[cat] = { count: 0, total: 0 };
            acc[cat].count += 1;
            acc[cat].total += r.amount || 0;
            return acc;
        },
        {}
    );

    const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };

    // Get unique years from receipts for the dropdown
    const availableYears = Array.from(
        new Set(
            exportable
                .map((r) => r.date?.substring(0, 4))
                .filter(Boolean) as string[]
        )
    ).sort((a, b) => b.localeCompare(a)); // Descending order

    const exportCSV = () => {
        // Filter by selected year
        let toExport = exportable;
        if (selectedYear !== "all") {
            toExport = exportable.filter((r) => r.date?.startsWith(selectedYear));
        }

        // Sort chronologically by date
        toExport.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            return dateA.localeCompare(dateB);
        });

        const headers = ["ID", "Store", "Date", "Amount", "Category", "Description", "Status"];
        const rows = toExport.map((r) => [
            escapeCSV(r.id),
            escapeCSV(r.store || ""),
            escapeCSV(r.date || ""),
            (r.amount || 0).toFixed(2),
            escapeCSV(r.category || ""),
            escapeCSV(r.description || ""),
            escapeCSV(r.status),
        ]);

        const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const yearStr = selectedYear !== "all" ? `-${selectedYear}` : "";
        a.download = `tax-receipts${yearStr}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShowYearModal(false); // Close modal after download
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
                    onClick={() => setShowYearModal(true)}
                    disabled={exportable.length === 0}
                    style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: exportable.length ? "pointer" : "not-allowed",
                        background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                        color: "#fff",
                        opacity: exportable.length > 0 ? 1 : 0.4,
                        transition: "all 0.2s ease",
                    }}
                >
                    📥 Export CSV{exportable.length > 0 ? ` (${exportable.length})` : ""}
                </button>
            </div>

            {/* Year Selection Modal */}
            <AnimatePresence>
                {showYearModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            style={{ padding: 24, width: '100%', maxWidth: 400, borderRadius: 16 }}
                        >
                            <h3 style={{ marginTop: 0, marginBottom: 16, color: '#f1f5f9' }}>Export Receipts</h3>
                            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
                                Select the tax year you want to export. Only receipts from this year will be included.
                            </p>

                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                style={{
                                    width: '100%', padding: 12, borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    marginBottom: 24, fontSize: 14, outline: 'none'
                                }}
                            >
                                <option value="all" style={{ background: '#1e293b' }}>All Years ({exportable.length} receipts)</option>
                                {availableYears.map(year => {
                                    const count = exportable.filter(r => r.date?.startsWith(year)).length;
                                    return (
                                        <option key={year} value={year} style={{ background: '#1e293b' }}>
                                            {year} ({count} receipts)
                                        </option>
                                    );
                                })}
                            </select>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowYearModal(false)}
                                    style={{
                                        padding: "8px 16px", borderRadius: 8, border: "none",
                                        background: "transparent", color: "#94a3b8", cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={exportCSV}
                                    style={{
                                        padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 600,
                                        background: "linear-gradient(135deg, #06b6d4, #3b82f6)", color: "#fff", cursor: "pointer"
                                    }}
                                >
                                    Download CSV
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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
