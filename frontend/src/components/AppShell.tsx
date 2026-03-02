"use client";
import { useEffect, useRef, useState } from "react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import LoginPage from "@/components/LoginPage";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function AuthGate({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const processedDuplicates = useRef<Set<string>>(new Set());

    // Global Duplicate Observer
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "receipts"),
            where("user_id", "==", user.uid),
            where("status", "==", "duplicate")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docs.forEach(async (d) => {
                if (processedDuplicates.current.has(d.id)) return;
                processedDuplicates.current.add(d.id);

                // Delay to ensure alert doesn't block UI thread unexpectedly
                setTimeout(async () => {
                    alert("⚠️ This receipt appears to be a duplicate and has already been processed!");
                    try {
                        await deleteDoc(doc(db, "receipts", d.id));
                    } catch (err) {
                        console.error("Failed to delete duplicate doc:", err);
                    }
                }, 100);
            });
        });

        return unsub;
    }, [user]);

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0a0e1a",
                }}
            >
                <div
                    style={{
                        width: 40,
                        height: 40,
                        border: "3px solid rgba(6, 182, 212, 0.2)",
                        borderTopColor: "#06b6d4",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                    }}
                />
            </div>
        );
    }

    if (!user) {
        return <LoginPage />;
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Mobile header with hamburger */}
            <div className="mobile-header">
                <button
                    onClick={() => setSidebarOpen(true)}
                    style={{
                        background: "none",
                        border: "none",
                        color: "#f1f5f9",
                        fontSize: 24,
                        cursor: "pointer",
                        padding: "4px 8px",
                    }}
                >
                    ☰
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                        }}
                    >
                        🏔️
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
                        Blue Hills
                    </span>
                </div>
                <div style={{ width: 40 }} /> {/* Spacer for centering */}
            </div>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AuthGate>{children}</AuthGate>
        </AuthProvider>
    );
}
