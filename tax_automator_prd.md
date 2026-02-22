Project Requirements Document (PRD): Blue Hills Tax Automator

1. Project Overview

A multimodal, agentic AI system designed to automate the categorization and recording of business receipts for tax purposes. The system targets self-employed entrepreneurs  who accumulate physical and digital receipts.

2. Technical Stack

Core Orchestration: Google ADK (Agent Development Kit).

AI Model: Gemini 2.5/3 Flash (Multimodal: Vision + Text).

IDE / Dev Environment: Google Antigravity.

Database: Firebase Firestore (Native Mode with Vector Search).

Storage: Google Cloud Storage (for raw receipt images).

Backend: Python (FastAPI) deployed on Google Cloud Run.

Frontend: Next.js (React) + Tailwind CSS + Magic UI components.

Protocol: A2A (Agent-to-Agent) for specialist handoffs.

Tooling: MCP (Model Context Protocol) for tax code retrieval.

3. Core Features & User Stories

A. Multimodal Receipt Intake

User Story: As a driver, I want to snap a photo of a gas receipt via WhatsApp or a web UI and have it processed immediately.

Action: Use Gemini Vision to extract the Store, Date, Amount, and Category fields.

B. Autonomous Categorization (Self-Healing)

User Story: If a receipt is blurry, I want the agent to request clarification rather than guess.

Action: Implement ADK Callbacks for error handling and user prompts.

C. Audit-Ready Reporting

User Story: At year-end, I want a single CSV/PDF for my accountant, with a rationale for each deduction.

Action: Generate a structured "Tax Trajectory" artifact from Firestore data.

4. Architecture Diagram (Conceptual)

Input (Mobile/Web) -> Firebase Storage -> ADK Agent (Gemini) -> Firestore (Metadata) -> MCP Tax Lookup -> User Notification

5. Security & Governance

IAM: Each sub-agent runs on a specific Google Cloud Service Account.

HITL: Manual approval required for expenses over $500 or "Uncategorized" flags.