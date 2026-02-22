/**
 * Gemini Live API WebSocket client for Next.js
 * Handles connection to proxy, session setup, and message exchange
 */

export type ResponseType =
    | "TEXT"
    | "AUDIO"
    | "SETUP_COMPLETE"
    | "INTERRUPTED"
    | "TURN_COMPLETE"
    | "TOOL_CALL"
    | "INPUT_TRANSCRIPTION"
    | "OUTPUT_TRANSCRIPTION";

export interface LiveMessage {
    type: ResponseType;
    data: string | { text: string; finished: boolean } | Record<string, unknown>;
    endOfTurn: boolean;
}

export interface GeminiLiveConfig {
    proxyUrl: string;
    projectId: string;
    model: string;
    systemInstruction: string;
    voiceName?: string;
}

function parseResponse(raw: Record<string, unknown>): LiveMessage {
    const msg: LiveMessage = { type: "TEXT", data: "", endOfTurn: false };

    const sc = raw.serverContent as Record<string, unknown> | undefined;
    msg.endOfTurn = !!(sc?.turnComplete);

    if (raw.setupComplete) {
        msg.type = "SETUP_COMPLETE";
    } else if (sc?.turnComplete) {
        msg.type = "TURN_COMPLETE";
    } else if (sc?.interrupted) {
        msg.type = "INTERRUPTED";
    } else if (sc?.inputTranscription) {
        msg.type = "INPUT_TRANSCRIPTION";
        const t = sc.inputTranscription as Record<string, unknown>;
        msg.data = { text: (t.text as string) || "", finished: !!t.finished };
    } else if (sc?.outputTranscription) {
        msg.type = "OUTPUT_TRANSCRIPTION";
        const t = sc.outputTranscription as Record<string, unknown>;
        msg.data = { text: (t.text as string) || "", finished: !!t.finished };
    } else if (raw.toolCall) {
        msg.type = "TOOL_CALL";
        msg.data = raw.toolCall as Record<string, unknown>;
    } else {
        const mt = sc?.modelTurn as Record<string, unknown> | undefined;
        const parts = (mt?.parts as Array<Record<string, unknown>>) || [];
        if (parts.length > 0 && parts[0].text) {
            msg.type = "TEXT";
            msg.data = parts[0].text as string;
        } else if (parts.length > 0 && parts[0].inlineData) {
            msg.type = "AUDIO";
            const d = parts[0].inlineData as Record<string, unknown>;
            msg.data = d.data as string;
        }
    }

    return msg;
}

export class GeminiLiveClient {
    private ws: WebSocket | null = null;
    private config: GeminiLiveConfig;
    private _connected = false;

    // callbacks
    onMessage: (msg: LiveMessage) => void = () => { };
    onConnected: () => void = () => { };
    onDisconnected: () => void = () => { };
    onError: (err: string) => void = () => { };

    constructor(config: GeminiLiveConfig) {
        this.config = config;
    }

    get connected() {
        return this._connected;
    }

    connect() {
        this.ws = new WebSocket(this.config.proxyUrl);

        this.ws.onopen = () => {
            this._connected = true;
            // First message: service URL for the proxy
            const modelUri = `projects/${this.config.projectId}/locations/us-central1/publishers/google/models/${this.config.model}`;
            const serviceUrl = `wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

            this.send({ service_url: serviceUrl });

            // Second message: session setup
            this.send({
                setup: {
                    model: modelUri,
                    generation_config: {
                        response_modalities: ["AUDIO"],
                        temperature: 0.9,
                        speech_config: {
                            voice_config: {
                                prebuilt_voice_config: {
                                    voice_name: this.config.voiceName || "Kore",
                                },
                            },
                        },
                    },
                    system_instruction: {
                        parts: [{ text: this.config.systemInstruction }],
                    },
                    input_audio_transcription: {},
                    output_audio_transcription: {},
                    realtime_input_config: {
                        automatic_activity_detection: {
                            disabled: false,
                            silence_duration_ms: 2000,
                            prefix_padding_ms: 500,
                        },
                    },
                },
            });

            this.onConnected();
        };

        this.ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                const msg = parseResponse(data);
                this.onMessage(msg);
            } catch (e) {
                console.error("Failed to parse WS message:", e);
            }
        };

        this.ws.onclose = () => {
            this._connected = false;
            this.onDisconnected();
        };

        this.ws.onerror = () => {
            this._connected = false;
            this.onError("WebSocket connection error");
        };
    }

    disconnect() {
        this.ws?.close();
        this._connected = false;
    }

    private send(data: unknown) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    sendText(text: string) {
        this.send({
            client_content: {
                turns: [{ role: "user", parts: [{ text }] }],
                turn_complete: true,
            },
        });
    }

    sendAudio(base64PCM: string) {
        this.send({
            realtime_input: {
                media_chunks: [{ mime_type: "audio/pcm", data: base64PCM }],
            },
        });
    }

    sendVideo(base64JPEG: string) {
        this.send({
            realtime_input: {
                media_chunks: [{ mime_type: "image/jpeg", data: base64JPEG }],
            },
        });
    }
}
