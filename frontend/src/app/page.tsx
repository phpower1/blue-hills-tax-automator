"use client";

import { useEffect, useState } from "react";
import { subscribeToReceipts, type Receipt } from "@/lib/firestore";
import StatsBar from "@/components/StatsBar";
import ReceiptCard from "@/components/ReceiptCard";

export default function DashboardPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const unsub = subscribeToReceipts((data) => {
      setReceipts(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered =
    filter === "all" ? receipts : receipts.filter((r) => r.status === filter);

  const filters = ["all", "new", "processing", "completed", "failed"];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: 6,
          }}
        >
          Dashboard
        </h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Monitor your receipts in real-time
        </p>
      </div>

      {/* Stats */}
      <StatsBar receipts={receipts} />

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
        }}
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textTransform: "capitalize",
              background:
                filter === f
                  ? "rgba(6, 182, 212, 0.15)"
                  : "rgba(255, 255, 255, 0.04)",
              color: filter === f ? "#06b6d4" : "#94a3b8",
              transition: "all 0.2s ease",
            }}
          >
            {f}
            {f !== "all" && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                {receipts.filter((r) => r.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Receipt Grid */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading receipts...
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="glass-card"
          style={{
            textAlign: "center",
            padding: 48,
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          No receipts found
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((receipt, i) => (
            <ReceiptCard key={receipt.id} receipt={receipt} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
