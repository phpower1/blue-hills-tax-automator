"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function TelegramLinker() {
    const { user } = useAuth();
    const [isLinked, setIsLinked] = useState<boolean | null>(null);
    const [linkingCode, setLinkingCode] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Listen for an existing link
        const q = query(
            collection(db, "telegram_links"),
            where("firebase_uid", "==", user.uid)
        );

        const unsub = onSnapshot(
            q,
            (snapshot) => {
                if (!snapshot.empty) {
                    setIsLinked(true);
                    setLinkingCode(null); // Success, hide code
                } else {
                    setIsLinked(false);
                }
            },
            (error) => {
                console.error("TelegramLinker onSnapshot error:", error);
                // Fall back to showing the component if there's an error
                setIsLinked(false);
            }
        );

        return unsub;
    }, [user]);

    const generateCode = async () => {
        if (!user) return;
        setIsGenerating(true);
        try {
            // Generate a random 6-digit code
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Store it in link_codes collection
            await setDoc(doc(db, "link_codes", code), {
                firebase_uid: user.uid,
                created_at: serverTimestamp()
            });

            setLinkingCode(code);
        } catch (error: any) {
            console.error("Failed to generate link code:", error);
            alert("Failed to generate code: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    if (isLinked === null) {
        return (
            <div style={{ marginTop: 16, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                Checking Telegram status...
            </div>
        );
    }

    if (isLinked) {
        return (
            <div style={{
                marginTop: 16,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#10b981",
                fontWeight: 600
            }}>
                <span style={{ fontSize: 16 }}>✓</span> Telegram Linked
            </div>
        );
    }

    return (
        <div style={{
            marginTop: 16,
            padding: "12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
        }}>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8, fontWeight: 500 }}>
                Link Telegram to enable texting receipts.
            </div>

            {!linkingCode ? (
                <button
                    onClick={generateCode}
                    disabled={isGenerating}
                    style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: 6,
                        border: "none",
                        background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isGenerating ? "wait" : "pointer",
                    }}
                >
                    {isGenerating ? "Generating..." : "Get Link Code"}
                </button>
            ) : (
                <div style={{
                    background: "#0a0e1a",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px dashed rgba(6, 182, 212, 0.4)",
                    textAlign: "center"
                }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        Message @bluehills_tax_bot
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#06b6d4", userSelect: "all" }}>
                        /link {linkingCode}
                    </div>
                </div>
            )}
        </div>
    );
}
