"use client";

import UploadZone from "@/components/UploadZone";

export default function UploadPage() {
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
                    Upload Receipts
                </h1>
                <p style={{ fontSize: 14, color: "#64748b" }}>
                    Upload receipt photos and the AI agent will process them automatically
                </p>
            </div>

            {/* Upload Zone */}
            <div style={{ maxWidth: 640 }}>
                <UploadZone />
            </div>

            {/* How it works */}
            <div style={{ marginTop: 48, maxWidth: 640 }}>
                <h2
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#94a3b8",
                        marginBottom: 20,
                    }}
                >
                    How it works
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {[
                        {
                            step: "1",
                            title: "Upload",
                            desc: "Drop a photo or snap one with your camera",
                            icon: "📤",
                        },
                        {
                            step: "2",
                            title: "AI Processing",
                            desc: "Gemini extracts store, date, amount, and category",
                            icon: "🤖",
                        },
                        {
                            step: "3",
                            title: "Categorized",
                            desc: "Your receipt is auto-categorized for tax filing",
                            icon: "✅",
                        },
                    ].map((item) => (
                        <div
                            key={item.step}
                            className="glass-card"
                            style={{
                                padding: "16px 20px",
                                display: "flex",
                                alignItems: "center",
                                gap: 16,
                            }}
                        >
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    background: "rgba(6, 182, 212, 0.1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 20,
                                    flexShrink: 0,
                                }}
                            >
                                {item.icon}
                            </div>
                            <div>
                                <div
                                    style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}
                                >
                                    {item.title}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    {item.desc}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
