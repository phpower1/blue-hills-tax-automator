import os
import logging

from fastapi import FastAPI, Request, HTTPException

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Tax Automator Agent")


@app.get("/")
async def root():
    return {"status": "ok", "service": "tax-automator-agent"}


@app.post("/process_receipt")
async def process_receipt(request: Request):
    """Handles Firestore document-creation events forwarded by Eventarc."""
    from google.cloud import firestore

    PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "blue-hills-tax-automator")
    db = firestore.Client(project=PROJECT_ID)

    logger.info("Received /process_receipt request")

    ce_subject = request.headers.get("ce-subject")
    if not ce_subject:
        logger.warning("Missing ce-subject header")
        return {"status": "ignored", "reason": "missing_subject"}

    # Parse receipt ID from subject
    try:
        receipt_id = (
            ce_subject.split("/documents/receipts/")[1].split("/")[0]
            if "/documents/receipts/" in ce_subject
            else ce_subject.split("/")[-1]
        )
    except Exception as e:
        logger.error(f"Failed to parse subject: {e}")
        return {"status": "error", "reason": "parse_error"}

    logger.info(f"Processing receipt {receipt_id}")

    # Fetch the Firestore document
    doc_ref = db.collection("receipts").document(receipt_id)
    doc = doc_ref.get()

    if not doc.exists:
        logger.error(f"Document {receipt_id} not found")
        return {"status": "error", "reason": "not_found"}

    data = doc.to_dict()
    if data.get("status") != "new":
        logger.info(f"Document status is '{data.get('status')}', skipping")
        return {"status": "skipped"}

    # Mark as processing
    doc_ref.update({"status": "processing"})

    # Build the agent prompt
    image_uri = data.get("gcs_uri") or data.get("imageUrl")
    user_id = data.get("user_id")
    prompt = f"Analyze the receipt with ID: {receipt_id}."
    if image_uri:
        prompt += f"\nThe receipt image is available at: {image_uri}"
    if user_id:
        prompt += f"\nThe user_id is: {user_id}. You MUST pass this user_id to the store_receipt_to_firestore tool."

    logger.info(f"Invoking agent for receipt {receipt_id}")

    try:
        from google.adk.runners import Runner
        from google.adk.sessions.in_memory_session_service import InMemorySessionService
        from google.genai import types
        from tax_automator.agent import root_agent

        session_service = InMemorySessionService()
        runner = Runner(
            agent=root_agent,
            app_name="tax_automator",
            session_service=session_service,
        )

        session = await session_service.create_session(
            app_name="tax_automator",
            user_id="system",
        )

        async for event in runner.run_async(
            user_id="system",
            session_id=session.id,
            new_message=types.Content(
                role="user", parts=[types.Part(text=prompt)]
            ),
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        logger.info(f"Agent: {part.text[:200]}")

        # Finalise status
        updated = doc_ref.get().to_dict()
        if updated.get("status") == "processing":
            doc_ref.update({"status": "completed"})

        return {"status": "success", "receipt_id": receipt_id}

    except Exception as e:
        logger.error(f"Agent execution failed: {e}", exc_info=True)
        doc_ref.update({"status": "failed", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
