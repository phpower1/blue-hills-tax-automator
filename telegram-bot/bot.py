import os
import json
import logging
from datetime import datetime
import hashlib

import firebase_admin
from firebase_admin import firestore, storage as fb_storage
from flask import Flask, request, jsonify
from telegram import Update, Bot
from telegram.constants import ParseMode
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Image, Tool, FunctionDeclaration

# ─── Config ───
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "blue-hills-tax-automator").strip()
REGION = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1").strip()

# ─── Init Firebase ───
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()
bucket = fb_storage.bucket(f"{PROJECT_ID}.firebasestorage.app")

# ─── Init Vertex AI / Gemini ───
vertexai.init(project=PROJECT_ID, location=REGION)

get_spending_summary_tool = FunctionDeclaration(
    name="get_spending_summary",
    description="Gets the total amount spent and a breakdown of spending by category within a specified date range. Dates should be in YYYY-MM-DD format. If no dates are provided, it summarizes all available data.",
    parameters={
        "type": "object",
        "properties": {
            "start_date": {
                "type": "string",
                "description": "Start date in YYYY-MM-DD format (inclusive)."
            },
            "end_date": {
                "type": "string",
                "description": "End date in YYYY-MM-DD format (inclusive)."
            }
        }
    }
)

get_recent_receipts_tool = FunctionDeclaration(
    name="get_recent_receipts",
    description="Gets a list of the most recent receipts, including store, date, amount, and category.",
    parameters={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Maximum number of receipts to return (default 5, max 20)."
            }
        }
    }
)

tools = Tool(function_declarations=[get_spending_summary_tool, get_recent_receipts_tool])
model = GenerativeModel("gemini-2.5-flash", tools=[tools])

# ─── Flask App ───
app = Flask(__name__)

RECEIPT_PROMPT = """You are a tax specialist. Analyze this image.
If it is clearly NOT a receipt, invoice, or tax-related document (e.g., a selfie, a cat, a landscape), respond ONLY with this JSON:
{"error": "not_tax_document"}

Otherwise, extract:
1. Store/vendor name
2. Date (YYYY-MM-DD format)
3. Total amount (number only, no currency symbol)
4. Brief description of main items

Then categorize it into one of these IRS tax categories:
- Auto Expenses (gas, fuel, oil change, car wash)
- Meals (restaurant, coffee, lunch, dinner)
- Travel (hotel, flight, airbnb, uber, lyft)
- Office Supplies (laptop, monitor, keyboard, software)
- Utilities (internet, phone, electricity)
- Professional Services (legal, consulting, accounting)
- Uncategorized (if none match)

Respond in this exact JSON format, nothing else:
{
    "store": "Store Name",
    "date": "YYYY-MM-DD",
    "amount": 0.00,
    "description": "Brief description of items",
    "category": "Category Name"
}"""

TEXT_PROMPT = """You are a friendly tax specialist assistant called Blue Hills Tax Bot.
The user sent a text message instead of a receipt photo.
Help them with tax-related questions, or remind them they can send receipt photos for automatic processing.
You have access to their receipt data. If they ask about their spending, use your tools to look it up!
Keep responses concise (2-3 sentences max).

User message: {message}"""

def get_spending_summary_db(firebase_uid: str, start_date: str = None, end_date: str = None) -> dict:
    """Queries Firestore for spending summary."""
    try:
        query = db.collection('receipts').where('user_id', '==', firebase_uid)
        if start_date:
            query = query.where('date', '>=', start_date)
        if end_date:
            query = query.where('date', '<=', end_date)
            
        docs = query.stream()
        
        total = 0
        by_category = {}
        count = 0
        
        for doc in docs:
            data = doc.to_dict()
            amount = float(data.get('amount', 0))
            category = data.get('category', 'Uncategorized')
            
            total += amount
            by_category[category] = by_category.get(category, 0) + amount
            count += 1
            
        return {
            "total_spent": total,
            "by_category": by_category,
            "receipt_count": count
        }
    except Exception as e:
        logger.error(f"Error in get_spending_summary_db: {e}")
        return {"error": str(e)}

def get_recent_receipts_db(firebase_uid: str, limit: int = 5) -> dict:
    """Queries Firestore for recent receipts."""
    try:
        limit = min(max(1, limit), 20)  # Clamp between 1 and 20
        docs = db.collection('receipts') \
            .where('user_id', '==', firebase_uid) \
            .order_by('created_at', direction=firestore.Query.DESCENDING) \
            .limit(limit) \
            .stream()
            
        receipts = []
        for doc in docs:
            data = doc.to_dict()
            receipts.append({
                "store": data.get('store', 'Unknown'),
                "date": data.get('date', 'N/A'),
                "amount": float(data.get('amount', 0)),
                "category": data.get('category', 'Uncategorized')
            })
            
        return {"receipts": receipts}
    except Exception as e:
        logger.error(f"Error in get_recent_receipts_db: {e}")
        return {"error": str(e)}


def categorize(description: str) -> str:
    """Same logic as tools.py tax_categorizer."""
    desc = description.lower()
    if any(k in desc for k in ['gas', 'fuel', 'oil change', 'car wash']):
        return "Auto Expenses"
    elif any(k in desc for k in ['meal', 'lunch', 'dinner', 'restaurant', 'coffee']):
        return "Meals"
    elif any(k in desc for k in ['hotel', 'flight', 'airbnb', 'uber', 'lyft']):
        return "Travel"
    elif any(k in desc for k in ['laptop', 'monitor', 'keyboard', 'mouse', 'software', 'office']):
        return "Office Supplies"
    elif any(k in desc for k in ['internet', 'phone', 'utility', 'electricity']):
        return "Utilities"
    elif any(k in desc for k in ['legal', 'consulting', 'accounting']):
        return "Professional Services"
    return "Uncategorized"


def upload_to_storage(photo_bytes: bytes, filename: str) -> tuple:
    """Upload photo to Firebase Storage. Returns (image_url, gcs_uri)."""
    timestamp = int(datetime.now().timestamp() * 1000)
    safe_name = filename.replace(' ', '_')
    storage_path = f"receipts/{timestamp}_{safe_name}"
    blob = bucket.blob(storage_path)
    blob.upload_from_string(photo_bytes, content_type='image/jpeg')
    blob.make_public()
    image_url = blob.public_url
    gcs_uri = f"gs://{bucket.name}/{storage_path}"
    return image_url, gcs_uri


def store_receipt(data: dict, telegram_user: str, firebase_uid: str, image_url: str = None, gcs_uri: str = None) -> str:
    """Store receipt to Firestore using deterministic ID to prevent duplicates."""
    store = data.get('store', 'Unknown')
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    amount = 0.0
    try:
        amount = float(data.get('amount', 0))
    except (ValueError, TypeError):
        pass
    
    unique_string = f"{store.strip().lower()}_{date.strip()}_{amount}"
    doc_id = hashlib.md5(unique_string.encode('utf-8')).hexdigest()
    
    doc_ref = db.collection('receipts').document(doc_id)
    if doc_ref.get().exists:
        raise ValueError("duplicate_receipt")
    
    doc_data = {
        'store': store,
        'date': date,
        'amount': amount,
        'category': data.get('category', 'Uncategorized'),
        'description': data.get('description', ''),
        'source': 'telegram',
        'telegram_user': telegram_user,
        'user_id': firebase_uid,
        'status': 'processed',
        'created_at': firestore.SERVER_TIMESTAMP,
    }
    if image_url:
        doc_data['image_url'] = image_url
    if gcs_uri:
        doc_data['gcs_uri'] = gcs_uri
        
    doc_ref.set(doc_data)
    return doc_ref.id


async def handle_photo(update: Update, bot: Bot):
    """Process a receipt photo."""
    chat_id = str(update.message.chat_id)
    user = update.message.from_user
    username = user.username or user.first_name or "Unknown"

    link_doc = db.collection("telegram_links").document(chat_id).get()
    if not link_doc.exists:
        await bot.send_message(chat_id, "⚠️ Please link your account first by typing `/link <code>` from your web dashboard.", parse_mode=ParseMode.MARKDOWN)
        return
    firebase_uid = link_doc.to_dict()["firebase_uid"]

    await bot.send_message(chat_id, "📸 Got your receipt! Analyzing with Gemini AI...")

    try:
        # Download the photo (highest resolution)
        photo = update.message.photo[-1]
        file = await bot.get_file(photo.file_id)
        photo_bytes = await file.download_as_bytearray()

        # Send to Gemini Vision via Vertex AI
        image_part = Part.from_data(data=bytes(photo_bytes), mime_type="image/jpeg")
        response = model.generate_content([RECEIPT_PROMPT, image_part])

        # Parse the JSON response
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        data = json.loads(text)

        if data.get("error") == "not_tax_document":
            await bot.send_message(
                chat_id,
                "⚠️ This doesn't look like a receipt or tax document. Please try sending a valid receipt or invoice!"
            )
            return

        # Double-check category
        if data.get('category') == 'Uncategorized' and data.get('description'):
            data['category'] = categorize(data['description'])

        # Upload image to Firebase Storage
        image_url, gcs_uri = upload_to_storage(bytes(photo_bytes), f"telegram_{chat_id}.jpg")

        # Store to Firestore
        doc_id = store_receipt(data, username, firebase_uid, image_url=image_url, gcs_uri=gcs_uri)

        # Format response
        amount = 0.0
        try:
            amount = float(data.get('amount', 0))
        except (ValueError, TypeError):
            pass

        status = "✅ Processed"

        reply = (
            f"🧾 Receipt Processed!\n\n"
            f"🏪 Store: {data.get('store', 'Unknown')}\n"
            f"📅 Date: {data.get('date', 'N/A')}\n"
            f"💰 Amount: ${amount:.2f}\n"
            f"🏷️ Category: {data.get('category', 'Uncategorized')}\n"
            f"📝 Items: {data.get('description', 'N/A')}\n\n"
            f"Status: {status}\n"
            f"🗂️ Saved to dashboard (ID: {doc_id[:8]}...)"
        )
        await bot.send_message(chat_id, reply)

    except ValueError as e:
        if str(e) == "duplicate_receipt":
            await bot.send_message(
                chat_id,
                "⚠️ This receipt appears to be a duplicate and has already been processed!"
            )
            return
        raise
    except json.JSONDecodeError:
        await bot.send_message(
            chat_id,
            "⚠️ I could see the image but couldn't extract receipt data. "
            "Make sure the receipt is clearly visible and try again!"
        )
    except Exception as e:
        logger.error(f"Error processing photo: {e}", exc_info=True)
        await bot.send_message(
            chat_id,
            f"❌ Error processing receipt. Please try again."
        )


async def handle_text(update: Update, bot: Bot):
    """Handle text messages."""
    chat_id = str(update.message.chat_id)
    text = update.message.text.strip()

    if text.startswith("/link "):
        code = text.split(" ")[1].strip()
        doc_ref = db.collection("link_codes").document(code)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            db.collection("telegram_links").document(chat_id).set({
                "firebase_uid": data["firebase_uid"],
                "created_at": firestore.SERVER_TIMESTAMP
            })
            doc_ref.delete()
            await bot.send_message(chat_id, "✅ Account successfully linked! You can now send receipts.")
        else:
            await bot.send_message(chat_id, "❌ Invalid or expired linking code.")
        return

    if text == "/start":
        await bot.send_message(
            chat_id,
            "👋 *Welcome to Blue Hills Tax Bot!*\n\n"
            "📸 Send me a photo of your receipt and I'll:\n"
            "• Extract store, date, and amount\n"
            "• Categorize it for IRS tax purposes\n"
            "• Save it to your dashboard\n\n"
            "💬 You can also ask me tax-related questions!\n\n"
            "🌐 View dashboard: blue-hills-tax-automator.web.app",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    if text == "/help":
        await bot.send_message(
            chat_id,
            "*📋 Commands:*\n"
            "/start — Welcome message\n"
            "/help — Show this help\n\n"
            "*📸 Send a receipt photo* to auto-process it\n"
            "*💬 Send a text* to ask tax questions",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    # User must be linked to use AI text
    link_doc = db.collection("telegram_links").document(chat_id).get()
    if not link_doc.exists:
        text_reply = "⚠️ Please link your account first by typing `/link <code>` from your web dashboard."
        await bot.send_message(chat_id, text_reply, parse_mode=ParseMode.MARKDOWN)
        return

    # Use Gemini for text responses
    try:
        chat = model.start_chat()
        response = chat.send_message(TEXT_PROMPT.format(message=text))

        # Handle tool calls if any
        fc_list = getattr(response.candidates[0].content.parts[0], 'function_call', None) if response.candidates else None
        if fc_list and fc_list.name:
            function_calls = [part.function_call for part in response.candidates[0].content.parts if hasattr(part, 'function_call') and part.function_call.name]
            for function_call in function_calls:
                func_name = function_call.name
                args = dict(function_call.args) if function_call.args else {}
                firebase_uid = link_doc.to_dict()["firebase_uid"]

                api_response = {}
                if func_name == "get_spending_summary":
                    api_response = get_spending_summary_db(
                        firebase_uid, 
                        args.get("start_date"), 
                        args.get("end_date")
                    )
                elif func_name == "get_recent_receipts":
                    api_response = get_recent_receipts_db(
                        firebase_uid, 
                        args.get("limit", 5)
                    )
                else:
                    api_response = {"error": f"Unknown function: {func_name}"}

                # Send function response back to Gemini to get the final answer
                response = chat.send_message(
                    Part.from_function_response(
                        name=func_name,
                        response={"content": api_response}
                    )
                )

        await bot.send_message(chat_id, response.text)
    except Exception as e:
        logger.error(f"Error handling text: {e}")
        await bot.send_message(chat_id, "Sorry, I couldn't process that. Try sending a receipt photo! 📸")


def _escape(text: str) -> str:
    """Escape special chars for MarkdownV2."""
    for ch in ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']:
        text = text.replace(ch, f'\\{ch}')
    return text


# ─── Webhook Endpoint ───
@app.route("/webhook", methods=["POST"])
def webhook():
    """Handle incoming Telegram webhook updates."""
    import asyncio
    data = request.get_json()
    logger.info(f"Received update: {json.dumps(data)[:200]}")

    async def process_update():
        async with Bot(token=TELEGRAM_TOKEN) as bot:
            update = Update.de_json(data, bot)
            if update.message:
                if update.message.photo:
                    await handle_photo(update, bot)
                elif update.message.text:
                    await handle_text(update, bot)

    try:
        asyncio.run(process_update())
    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)

    return jsonify({"ok": True})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "telegram-bot"})


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "Blue Hills Tax Bot (Telegram)",
        "status": "running",
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
