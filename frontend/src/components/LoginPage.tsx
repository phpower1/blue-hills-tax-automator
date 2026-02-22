"use client";

import { useAuth } from "@/components/AuthProvider";
import { motion } from "framer-motion";

export default function LoginPage() {
    const { signInWithGoogle, loading, error } = useAuth();

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0f172a 100%)",
                padding: 24,
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                    width: "100%",
                    maxWidth: 420,
                    textAlign: "center",
                }}
            >
                {/* Logo */}
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: 20,
                        background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 36,
                        margin: "0 auto 24px",
                        boxShadow: "0 0 40px rgba(6, 182, 212, 0.3)",
                    }}
                >
                    🏔️
                </div>

                <h1
                    style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: "#f1f5f9",
                        marginBottom: 4,
                        letterSpacing: "-0.03em",
                    }}
                >
                    Blue Hills
                </h1>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#06b6d4",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        marginBottom: 32,
                    }}
                >
                    Tax Automator
                </div>

                <p
                    style={{
                        color: "#94a3b8",
                        fontSize: 14,
                        lineHeight: 1.6,
                        marginBottom: 40,
                        maxWidth: 320,
                        margin: "0 auto 40px",
                    }}
                >
                    AI-powered receipt processing and tax categorization for
                    self-employed entrepreneurs.
                </p>

                {/* Sign In Card */}
                <div
                    style={{
                        padding: 32,
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        backdropFilter: "blur(20px)",
                    }}
                >
                    <button
                        onClick={signInWithGoogle}
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: "14px 24px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.06)",
                            color: "#f1f5f9",
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: loading ? "wait" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 12,
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                            e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        {loading ? "Loading..." : "Continue with Google"}
                    </button>

                    {error && (
                        <div style={{
                            marginTop: 16,
                            padding: "12px 16px",
                            borderRadius: 10,
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            color: "#fca5a5",
                            fontSize: 12,
                            lineHeight: 1.5,
                            textAlign: "left",
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <p style={{ color: "#64748b", fontSize: 12, marginTop: 16, lineHeight: 1.5 }}>
                        Sign in to upload receipts, view your dashboard, and chat with our
                        AI tax assistant.
                    </p>
                </div>

                <p style={{ color: "#475569", fontSize: 11, marginTop: 24 }}>
                    Powered by Gemini Live API · Google Cloud
                </p>
            </motion.div>
        </div>
    );
}
