"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatBubble from "@/components/ChatBubble";
import { GeminiLiveClient, type LiveMessage } from "@/lib/gemini-live";
import { MicCapture, AudioPlayer, CameraCapture } from "@/lib/media-utils";
import { useAuth } from "@/components/AuthProvider";
import { getSpendingSummary, getRecentReceipts } from "@/lib/firestore";

interface Message {
    id: string;
    role: "user" | "assistant";
    text: string;
    isStreaming?: boolean;
}

const PROXY_URL =
    process.env.NEXT_PUBLIC_LIVE_PROXY_URL || "ws://localhost:8080";
const PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "blue-hills-tax-automator";
const MODEL = "gemini-live-2.5-flash-native-audio";

const SYSTEM_INSTRUCTION = `You are the Blue Hills Tax Automator — a friendly, conversational AI tax assistant.
You help self-employed entrepreneurs organize receipts and categorize expenses for tax filing.

Your capabilities:
- Analyze receipt images the user shows you via camera
- Answer questions about tax categories (Office Supplies, Meals, Travel, Auto Expenses, Utilities, Professional Services)
- Help users understand their deductions
- Flag expenses over $500 for manual review

Be conversational, concise, and proactive. If you see a receipt via camera, immediately start extracting details.
Greet the user warmly and ask how you can help with their taxes today.`;

export default function ChatPage() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [status, setStatus] = useState<
        "disconnected" | "connecting" | "connected"
    >("disconnected");
    const [micActive, setMicActive] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);

    const clientRef = useRef<GeminiLiveClient | null>(null);
    const micRef = useRef<MicCapture | null>(null);
    const playerRef = useRef<AudioPlayer | null>(null);
    const cameraRef = useRef<CameraCapture | null>(null);
    const videoPreviewRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const assistantBufferRef = useRef<string>("");

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const addMessage = useCallback(
        (role: "user" | "assistant", text: string, streaming = false) => {
            const id = `${Date.now()}_${Math.random()}`;
            setMessages((prev) => [...prev, { id, role, text, isStreaming: streaming }]);
            return id;
        },
        []
    );

    const updateLastAssistant = useCallback(
        (text: string, streaming = true) => {
            setMessages((prev) => {
                const last = [...prev];
                for (let i = last.length - 1; i >= 0; i--) {
                    if (last[i].role === "assistant") {
                        last[i] = { ...last[i], text, isStreaming: streaming };
                        return last;
                    }
                }
                // No assistant message found, create one
                return [
                    ...prev,
                    {
                        id: `${Date.now()}_${Math.random()}`,
                        role: "assistant" as const,
                        text,
                        isStreaming: streaming,
                    },
                ];
            });
        },
        []
    );

    const handleMessage = useCallback(
        async (msg: LiveMessage) => {
            switch (msg.type) {
                case "SETUP_COMPLETE":
                    setStatus("connected");
                    break;

                case "AUDIO":
                    // Play audio response
                    if (typeof msg.data === "string") {
                        if (!playerRef.current) {
                            playerRef.current = new AudioPlayer();
                        }
                        playerRef.current.play(msg.data);
                    }
                    break;

                case "OUTPUT_TRANSCRIPTION": {
                    const t = msg.data as { text: string; finished: boolean };
                    assistantBufferRef.current += t.text;
                    updateLastAssistant(assistantBufferRef.current, !t.finished);
                    break;
                }

                case "INPUT_TRANSCRIPTION": {
                    const t = msg.data as { text: string; finished: boolean };
                    if (t.finished && t.text.trim()) {
                        addMessage("user", t.text.trim());
                    }
                    break;
                }

                case "TURN_COMPLETE":
                    if (assistantBufferRef.current.trim()) {
                        updateLastAssistant(assistantBufferRef.current, false);
                    }
                    assistantBufferRef.current = "";
                    break;

                case "INTERRUPTED":
                    playerRef.current?.interrupt();
                    if (assistantBufferRef.current.trim()) {
                        updateLastAssistant(assistantBufferRef.current, false);
                    }
                    assistantBufferRef.current = "";
                    break;

                case "TEXT":
                    if (typeof msg.data === "string") {
                        assistantBufferRef.current += msg.data;
                        updateLastAssistant(assistantBufferRef.current, true);
                    }
                    break;

                case "TOOL_CALL": {
                    const rawData = msg.data as Record<string, unknown>;
                    const functionCalls = rawData.functionCalls as Array<{
                        id: string;
                        name: string;
                        args: Record<string, unknown>;
                    }>;

                    if (functionCalls && user) {
                        const responses = await Promise.all(
                            functionCalls.map(async (call) => {
                                try {
                                    if (call.name === "get_spending_summary") {
                                        const { start_date, end_date } = call.args as { start_date?: string; end_date?: string };
                                        const data = await getSpendingSummary(user.uid, start_date, end_date);
                                        return { id: call.id, name: call.name, response: data };
                                    } else if (call.name === "get_recent_receipts") {
                                        const { limit } = call.args as { limit?: number };
                                        const data = await getRecentReceipts(user.uid, limit);
                                        return { id: call.id, name: call.name, response: { receipts: data } };
                                    }
                                    return { id: call.id, name: call.name, response: { error: "Unknown function" } };
                                } catch (e) {
                                    return { id: call.id, name: call.name, response: { error: String(e) } };
                                }
                            })
                        );
                        clientRef.current?.sendToolResponse(responses);
                    }
                    break;
                }
            }
        },
        [addMessage, updateLastAssistant, user]
    );

    const connect = useCallback(() => {
        if (clientRef.current?.connected) return;

        setStatus("connecting");
        const client = new GeminiLiveClient({
            proxyUrl: PROXY_URL,
            projectId: PROJECT_ID,
            model: MODEL,
            systemInstruction: SYSTEM_INSTRUCTION,
            voiceName: "Kore",
        });

        client.onMessage = handleMessage;
        client.onConnected = () => setStatus("connected");
        client.onDisconnected = () => {
            setStatus("disconnected");
            setMicActive(false);
            setCameraActive(false);
        };
        client.onError = (err) => {
            console.error("Live API error:", err);
            setStatus("disconnected");
        };

        client.connect();
        clientRef.current = client;
    }, [handleMessage]);

    const disconnect = useCallback(() => {
        clientRef.current?.disconnect();
        micRef.current?.stop();
        cameraRef.current?.stop();
        playerRef.current?.destroy();
        setMicActive(false);
        setCameraActive(false);
        setStatus("disconnected");
    }, []);

    const sendText = useCallback(() => {
        if (!inputText.trim() || !clientRef.current?.connected) return;
        addMessage("user", inputText.trim());
        // Create empty assistant bubble for upcoming response
        addMessage("assistant", "", true);
        clientRef.current.sendText(inputText.trim());
        setInputText("");
    }, [inputText, addMessage]);

    const toggleMic = useCallback(async () => {
        if (micActive) {
            micRef.current?.stop();
            micRef.current = null;
            setMicActive(false);
        } else {
            const mic = new MicCapture();
            mic.onAudioChunk = (b64) => {
                clientRef.current?.sendAudio(b64);
            };
            await mic.start();
            micRef.current = mic;
            setMicActive(true);
            // Create assistant bubble for audio response
            addMessage("assistant", "", true);
        }
    }, [micActive, addMessage]);

    const toggleCamera = useCallback(async () => {
        if (cameraActive) {
            cameraRef.current?.stop();
            cameraRef.current = null;
            if (videoPreviewRef.current) videoPreviewRef.current.innerHTML = "";
            setCameraActive(false);
        } else {
            const cam = new CameraCapture();
            cam.onFrame = (b64) => {
                clientRef.current?.sendVideo(b64);
            };
            const videoEl = await cam.start();
            cameraRef.current = cam;
            if (videoPreviewRef.current) {
                videoPreviewRef.current.innerHTML = "";
                videoEl.style.width = "100%";
                videoEl.style.height = "100%";
                videoEl.style.objectFit = "cover";
                videoEl.style.borderRadius = "50%";
                videoPreviewRef.current.appendChild(videoEl);
            }
            setCameraActive(true);
        }
    }, [cameraActive]);

    // Auto-connect on mount, cleanup on unmount
    useEffect(() => {
        connect();
        return () => {
            clientRef.current?.disconnect();
            micRef.current?.stop();
            cameraRef.current?.stop();
            playerRef.current?.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const statusColors = {
        disconnected: "#ef4444",
        connecting: "#f59e0b",
        connected: "#10b981",
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "calc(100vh - 64px)",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: "-0.03em",
                            marginBottom: 4,
                        }}
                    >
                        Chat with Agent
                    </h1>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: statusColors[status],
                                boxShadow: `0 0 8px ${statusColors[status]}80`,
                            }}
                        />
                        <span style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>
                            {status}
                        </span>
                    </div>
                </div>
                <button
                    onClick={status === "disconnected" ? connect : disconnect}
                    style={{
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        background:
                            status === "disconnected"
                                ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
                                : "rgba(239, 68, 68, 0.15)",
                        color: status === "disconnected" ? "#fff" : "#f87171",
                        transition: "all 0.2s ease",
                    }}
                >
                    {status === "disconnected" ? "🔌 Connect" : "⏹ Disconnect"}
                </button>
            </div>

            {/* Chat Area */}
            <div
                className="glass-card"
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                {/* Messages */}
                <div
                    style={{
                        flex: 1,
                        overflow: "auto",
                        padding: "24px",
                    }}
                >
                    {messages.length === 0 && (
                        <div
                            style={{
                                textAlign: "center",
                                color: "#64748b",
                                paddingTop: 80,
                            }}
                        >
                            <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
                            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                                Blue Hills Tax Assistant
                            </div>
                            <div style={{ fontSize: 13, maxWidth: 360, margin: "0 auto" }}>
                                {status === "connecting" ? "Connecting to your tax assistant..." : "Start talking about your receipts. You can type, speak, or show receipts via camera."}
                            </div>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <ChatBubble
                            key={msg.id}
                            role={msg.role}
                            text={msg.text}
                            isStreaming={msg.isStreaming}
                        />
                    ))}
                    <div ref={chatEndRef} />
                </div>

                {/* Camera Preview */}
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: cameraActive ? 1 : 0, opacity: cameraActive ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    ref={videoPreviewRef}
                    style={{
                        position: "absolute",
                        bottom: 80,
                        right: 24,
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "3px solid #06b6d4",
                        boxShadow: "0 0 20px rgba(6, 182, 212, 0.3)",
                        pointerEvents: cameraActive ? "auto" : "none",
                        backgroundColor: "#000",
                        zIndex: 10,
                    }}
                />

                {/* Input Bar */}
                <div
                    style={{
                        padding: "16px 24px",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                    }}
                >
                    {/* Mic Button */}
                    <button
                        onClick={toggleMic}
                        disabled={status !== "connected"}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            cursor: status === "connected" ? "pointer" : "not-allowed",
                            background: micActive
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(255,255,255,0.06)",
                            color: micActive ? "#f87171" : "#94a3b8",
                            transition: "all 0.2s ease",
                            flexShrink: 0,
                            animation: micActive ? "pulse-soft 1.5s infinite" : "none",
                        }}
                        title={micActive ? "Stop microphone" : "Start microphone"}
                    >
                        🎤
                    </button>

                    {/* Camera Button */}
                    <button
                        onClick={toggleCamera}
                        disabled={status !== "connected"}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 20,
                            cursor: status === "connected" ? "pointer" : "not-allowed",
                            background: cameraActive
                                ? "rgba(6, 182, 212, 0.2)"
                                : "rgba(255,255,255,0.06)",
                            color: cameraActive ? "#06b6d4" : "#94a3b8",
                            transition: "all 0.2s ease",
                            flexShrink: 0,
                        }}
                        title={cameraActive ? "Stop camera" : "Start camera"}
                    >
                        📹
                    </button>

                    {/* Text Input */}
                    <input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendText()}
                        placeholder={
                            status === "connected"
                                ? "Type a message..."
                                : "Connect to start chatting"
                        }
                        disabled={status !== "connected"}
                        style={{
                            flex: 1,
                            padding: "12px 18px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.06)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#f1f5f9",
                            fontSize: 14,
                            outline: "none",
                        }}
                    />

                    {/* Send Button */}
                    <button
                        onClick={sendText}
                        disabled={status !== "connected" || !inputText.trim()}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                            cursor:
                                status === "connected" && inputText.trim()
                                    ? "pointer"
                                    : "not-allowed",
                            background:
                                inputText.trim()
                                    ? "linear-gradient(135deg, #06b6d4, #3b82f6)"
                                    : "rgba(255,255,255,0.06)",
                            color: inputText.trim() ? "#fff" : "#64748b",
                            transition: "all 0.2s ease",
                            flexShrink: 0,
                        }}
                    >
                        ➤
                    </button>
                </div>
            </div>
        </div>
    );
}
