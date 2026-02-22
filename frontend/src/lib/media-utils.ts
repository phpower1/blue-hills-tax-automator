/**
 * Media utilities for audio/video capture and playback
 * Used with Gemini Live API
 */

// ─── Audio Capture (Microphone → PCM 16-bit 16kHz → base64) ───

export class MicCapture {
    private stream: MediaStream | null = null;
    private audioCtx: AudioContext | null = null;
    private processor: ScriptProcessorNode | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private _active = false;

    onAudioChunk: (base64PCM: string) => void = () => { };

    get active() {
        return this._active;
    }

    async start() {
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        this.audioCtx = new AudioContext({ sampleRate: 16000 });
        this.source = this.audioCtx.createMediaStreamSource(this.stream);

        // ScriptProcessorNode: simple, wide browser support
        this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => {
            if (!this._active) return;
            const float32 = e.inputBuffer.getChannelData(0);
            const pcm16 = float32ToPCM16(float32);
            const b64 = arrayBufferToBase64(pcm16);
            this.onAudioChunk(b64);
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioCtx.destination);
        this._active = true;
    }

    stop() {
        this._active = false;
        this.processor?.disconnect();
        this.source?.disconnect();
        this.stream?.getTracks().forEach((t) => t.stop());
        this.audioCtx?.close();
        this.stream = null;
        this.audioCtx = null;
        this.processor = null;
        this.source = null;
    }
}

// ─── Audio Playback (base64 PCM 24kHz → speakers) ───

export class AudioPlayer {
    private audioCtx: AudioContext | null = null;
    private nextStartTime = 0;

    async init() {
        if (!this.audioCtx) {
            this.audioCtx = new AudioContext({ sampleRate: 24000 });
        }
        if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
        }
        this.nextStartTime = this.audioCtx.currentTime;
    }

    async play(base64Audio: string) {
        if (!this.audioCtx) await this.init();
        const ctx = this.audioCtx!;

        if (ctx.state === "suspended") await ctx.resume();

        const bytes = base64ToUint8Array(base64Audio);
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 32768;
        }

        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const start = Math.max(now, this.nextStartTime);
        source.start(start);
        this.nextStartTime = start + buffer.duration;
    }

    interrupt() {
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
            this.nextStartTime = 0;
        }
    }

    destroy() {
        this.audioCtx?.close();
        this.audioCtx = null;
    }
}

// ─── Video Capture (Camera → JPEG 1FPS → base64) ───

export class CameraCapture {
    private stream: MediaStream | null = null;
    private video: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private interval: ReturnType<typeof setInterval> | null = null;
    private _active = false;

    onFrame: (base64JPEG: string) => void = () => { };

    get active() {
        return this._active;
    }

    getVideoElement() {
        return this.video;
    }

    async start(): Promise<HTMLVideoElement> {
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });

        this.video = document.createElement("video");
        this.video.srcObject = this.stream;
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.video.muted = true;

        this.canvas = document.createElement("canvas");
        this.canvas.width = 640;
        this.canvas.height = 480;

        await new Promise<void>((res) => {
            this.video!.onloadedmetadata = () => res();
        });
        this.video.play();

        this._active = true;
        this.interval = setInterval(() => this.captureFrame(), 1000);

        return this.video;
    }

    private captureFrame() {
        if (!this._active || !this.video || !this.canvas) return;
        const ctx = this.canvas.getContext("2d")!;
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        this.canvas.toBlob(
            (blob) => {
                if (!blob) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                    const b64 = (reader.result as string).split(",")[1];
                    this.onFrame(b64);
                };
                reader.readAsDataURL(blob);
            },
            "image/jpeg",
            0.7
        );
    }

    stop() {
        this._active = false;
        if (this.interval) clearInterval(this.interval);
        this.stream?.getTracks().forEach((t) => t.stop());
        this.video = null;
        this.canvas = null;
        this.stream = null;
        this.interval = null;
    }
}

// ─── Helpers ───

function float32ToPCM16(float32: Float32Array): ArrayBuffer {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s * 0x7fff;
    }
    return int16.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
