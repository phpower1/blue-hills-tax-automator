# Blue Hills Tax Automator 🏔️

**A multimodal, agentic AI system designed to automate the categorization and recording of business receipts for self-employed entrepreneurs.** built for the Google Gemini Hackathon.

## 🌟 The Problem
Self-employed entrepreneurs and freelancers waste hours manually data-entering receipts, categorizing expenses for taxes, and finding lost physical receipts. It's a tedious, error-prone process that often leads to missed deductions or audit risks.

## 🚀 The Solution: Blue Hills Tax Automator
We built an autonomous, multimodal tax assistant powered by the Google AI Agent Development Kit (ADK) and Gemini Models. It allows users to:
1. **Talk to their Tax Assistant:** Have real-time, voice-to-voice conversations using the **Gemini Live API** to discuss tax categories, ask questions, or just hold up a receipt to the camera to have it instantly analyzed.
2. **Text a Receipt on the Go:** Simply snap a photo of a receipt in Telegram, and our Cloud Run-hosted bot will automatically extract the vendor, date, amount, categorize it into an IRS bucket, and save it to the cloud.
3. **Manage via Dashboard:** View a beautiful, responsive Next.js dashboard to see real-time updates, approve flagged expenses (>$500), and download year-end CSV reports.

---

## ✨ Key Features & Technical Highlights

### 1. Real-time Multimodal Live Chat (Gemini Live API)
We integrated the `gemini-live-2.5-flash-native-audio` model via a custom WebSocket proxy hosted on Google Cloud Run. 
* **Voice In/Out:** Streams 16kHz PCM audio directly from the browser microphone to Gemini, and plays back 24kHz PCM audio natively.
* **Vision / Camera Input:** Streams 1FPS JPEG frames from the user's local webcam. Users can literally hold up a receipt to their laptop camera, and the agent will extract the data and talk back to them.
* **Barge-in / Interruption:** Users can naturally interrupt the AI assistant mid-sentence.

### 2. Autonomous Agent Orchestration (Google ADK)
* Utilizes the **Google Agent Development Kit (ADK)** to define a `Tax Specialist` agent (`gemini-2.5-flash`).
* The agent is equipped with specific Python tools to autonomously apply IRS tax categorization rules and execute Firestore database writes.

### 3. Telegram Bot Integration (On-the-go Intake)
* A Python Flask application deployed on Cloud Run acts as a Telegram Webhook.
* Uses the **Vertex AI SDK** (`google-cloud-aiplatform`) with service account authentication to analyze incoming photos via Gemini Vision.
* Automatically stores the structured JSON data into Firestore.

### 4. Real-time Next.js Dashboard
* Modern tech stack: Next.js (React), framer-motion animations, Tailwind CSS.
* **Firebase Native Mode:** Uses Realtime listeners (`onSnapshot`) so that when a receipt is texted via Telegram or uploaded via the UI, it instantly appears on the dashboard without refreshing.
* **Responsive Design:** Includes mobile-friendly slide-in drawers and a "Take Photo" native HTML capture button for mobile browsers.

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Frontend["Next.js (Firebase Hosting)"]
        D[Dashboard]
        U[Upload / Camera]
        C[Live Chat]
        R[Reports]
    end
    
    subgraph Cloud["Google Cloud / Firebase"]
        P[WebSocket Proxy<br/>Cloud Run]
        A[Tax Agent<br/>ADK + Cloud Run]
        T[Telegram Webhook<br/>Cloud Run]
        F[(Firestore)]
        S[(Cloud Storage)]
        G1["Gemini 2.5 Flash"]
        G2["Gemini Live API<br/>Native Audio"]
    end
    
    subgraph External["External"]
        TG[Telegram App]
    end

    U -->|Upload image| S
    S -->|Eventarc Trigger| A
    A -->|Extract & Write| F
    
    TG -->|Send Photo| T
    T -->|Analyze| G1
    T -->|Write| F

    C -->|WebSocket (PCM/JPEG)| P
    P -->|WSS| G2
    
    D -->|Real-time listener| F
    R -->|Query & Export| F
```

---

## 💻 Tech Stack
* **AI & Agents:** Google Gemini 2.5 Flash, Gemini Live API (WebSocket), Google Agent Development Kit (ADK), Vertex AI SDK
* **Backend:** Python, Flask, asyncio, aiohttp (Live Proxy)
* **Cloud Infrastructure:** Google Cloud Run, Eventarc
* **Database & Storage:** Firebase Firestore, Firebase Cloud Storage, Firebase Hosting
* **Frontend:** Next.js (TypeScript), React, Tailwind CSS, Framer Motion

## 🛠️ Setup & Local Development

This repository consists of multiple services:

### 1. `frontend/` (Next.js Dashboard)
```bash
cd frontend
npm install
npm run dev
```

### 2. `tax_automator/` (ADK Agent)
Houses the Google ADK definition for the Tax Specialist agent.
```bash
cd tax_automator
pip install agent_development_kit
# Start the ADK Web Server UI
python -m agent_development_kit.server --host 0.0.0.0 --port 8000
```

### 3. `telegram-bot/` (Cloud Run Webhook)
A Flask app that listens for Telegram messages and uses Vertex AI to process receipts.
```bash
cd telegram-bot
pip install -r requirements.txt
python bot.py
```

### 4. `live-proxy/` (Gemini Live API Proxy)
An `aiohttp` WebSocket server that sits between the Next.js browser client and the Gemini Live API, handling GCP access token generation.
```bash
cd live-proxy
pip install -r requirements.txt
python server.py
```
