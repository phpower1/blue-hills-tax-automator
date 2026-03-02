import os
import logging

from fastapi import FastAPI, Request, HTTPException

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import firebase_admin
firebase_admin.initialize_app()

app = FastAPI(title="Tax Automator Agent")

@app.on_event("startup")
async def startup_event():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if api_key:
        logger.info("GOOGLE_API_KEY is set")
    else:
        logger.warning("GOOGLE_API_KEY is NOT set")


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
    from google.genai.types import Part, Content

    image_uri = data.get("gcs_uri") or data.get("image_url")
    user_id = data.get("user_id")
    prompt = f"Analyze the receipt with ID: {receipt_id}."
    
    parts = [Part.from_text(text=prompt)]
    
    if image_uri and image_uri.startswith("gs://"):
        from firebase_admin import storage
        try:
            # Parse bucket and path: gs://bucket-name/path/to/blob
            parts_uri = image_uri.replace("gs://", "").split("/", 1)
            bucket_name = parts_uri[0]
            blob_path = parts_uri[1]
            
            bucket = storage.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            image_bytes = blob.download_as_bytes()
            parts.append(Part.from_bytes(data=image_bytes, mime_type="image/jpeg"))
            logger.info(f"Successfully downloaded image from {image_uri}")
        except Exception as e:
            logger.error(f"Failed to download image from GCS: {e}")
            # Fallback
            prompt += f"\n(Image at {image_uri} could not be retrieved directly)"
            parts[0] = Part.from_text(text=prompt)
    elif image_uri:
        prompt += f"\nThe receipt image is available at: {image_uri}"
        parts = [Part.from_text(text=prompt)]
        
    if user_id:
        prompt += f"\nThe user_id is: {user_id}. You MUST pass this user_id to the store_receipt_to_firestore tool."
        parts[0] = Part.from_text(text=prompt)

    logger.info(f"Invoking agent for receipt {receipt_id}")

    try:
        from google.adk.runners import Runner
        from google.adk.sessions.in_memory_session_service import InMemorySessionService
        from agent import root_agent

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
            new_message=Content(
                role="user", parts=parts
            ),
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        logger.info(f"Agent: {part.text[:200]}")

        # Finalise status only if it hasn't been changed by a tool (like duplicate detection)
        # We fetch the document again to see current status
        updated_doc = doc_ref.get()
        if updated_doc.exists:
            current_status = updated_doc.to_dict().get("status")
            if current_status == "processing":
                doc_ref.update({"status": "completed"})
            elif current_status == "duplicate":
                logger.info(f"Receipt {receipt_id} marked as duplicate by tool.")
        
        return {"status": "success", "receipt_id": receipt_id}

    except Exception as e:
        logger.error(f"Agent execution failed: {e}", exc_info=True)
        doc_ref.update({"status": "failed", "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))
