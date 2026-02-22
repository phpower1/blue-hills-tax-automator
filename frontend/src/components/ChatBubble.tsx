"use client";

import { motion } from "framer-motion";

interface ChatBubbleProps {
    role: "user" | "assistant";
    text: string;
    isStreaming?: boolean;
}

export default function ChatBubble({ role, text, isStreaming }: ChatBubbleProps) {
    const isUser = role === "user";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                marginBottom: 12,
            }}
        >
            <div
                style={{
                    maxWidth: "70%",
                    padding: "12px 18px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isUser
                        ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
                        : "rgba(255, 255, 255, 0.06)",
                    border: isUser ? "none" : "1px solid rgba(255,255,255,0.06)",
                    color: isUser ? "#fff" : "#f1f5f9",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap" as const,
                    wordBreak: "break-word" as const,
                }}
            >
                {text}
                {isStreaming && (
                    <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        style={{
                            display: "inline-block",
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: isUser ? "#fff" : "#06b6d4",
                            marginLeft: 6,
                            verticalAlign: "middle",
                        }}
                    />
                )}
            </div>
        </motion.div>
    );
}
