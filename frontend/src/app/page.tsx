"use client";

import { useEffect, useState, useRef } from "react";
import { subscribeToReceipts, type Receipt } from "@/lib/firestore";
import { doc, deleteDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import StatsBar from "@/components/StatsBar";
import ReceiptCard from "@/components/ReceiptCard";
import { useAuth } from "@/components/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardPage() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;

    const unsub = subscribeToReceipts(user.uid, (data) => {
      setReceipts(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const filtered =
    filter === "all" ? receipts : receipts.filter((r) => r.status === filter);

  const filters = ["all", "new", "processing", "processed", "needs_approval", "completed", "failed"];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40, marginTop: 24 }}>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: 8,
            background: "linear-gradient(to bottom right, #f8fafc, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Dashboard
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          style={{ fontSize: 15, color: "#64748b", fontWeight: 500 }}
        >
          Your automated tax workspace
        </motion.p>
      </div>

      {/* Stats */}
      <StatsBar receipts={receipts} />

      {/* Control Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
          padding: "8px",
          background: "rgba(30, 41, 59, 0.3)",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.03)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 16px",
                borderRadius: "12px",
                border: "1px solid transparent",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                background: filter === f ? "rgba(6, 182, 212, 0.1)" : "transparent",
                color: filter === f ? "#22d3ee" : "#64748b",
                borderColor: filter === f ? "rgba(6, 182, 212, 0.2)" : "transparent",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(e) => {
                if (filter !== f) e.currentTarget.style.color = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                if (filter !== f) e.currentTarget.style.color = "#64748b";
              }}
            >
              {f}
              {f !== "all" && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    opacity: 0.6,
                    padding: "2px 6px",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "6px"
                  }}
                >
                  {receipts.filter((r) => r.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Receipt Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              textAlign: "center",
              padding: "100px 0",
              color: "#64748b",
            }}
          >
            <div className="loading-spinner" style={{ marginBottom: 20 }} />
            <p style={{ fontWeight: 500, letterSpacing: "0.02em" }}>Syncing with records...</p>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card"
            style={{
              textAlign: "center",
              padding: "80px 40px",
              color: "#64748b",
              borderRadius: "32px",
              background: "rgba(15, 23, 42, 0.4)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 24, opacity: 0.5 }}>📂</div>
            <h3 style={{ color: "#f1f5f9", marginBottom: 8, fontSize: 18 }}>No receipts found</h3>
            <p style={{ fontSize: 14 }}>Try uploading a new photo or changing your filters.</p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 24,
              paddingBottom: 40,
            }}
          >
            {filtered.map((receipt, i) => (
              <ReceiptCard key={receipt.id} receipt={receipt} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
