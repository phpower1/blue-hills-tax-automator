import os
import json
import logging
from datetime import datetime
import hashlib

import firebase_admin
from firebase_admin import firestore
from flask import Flask, request, jsonify
from telegram import Update, Bot
from telegram.constants import ParseMode
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Image

# ─── Config ───
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "blue-hills-tax-automator")
REGION = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")

# ─── Init Firebase ───
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

# ─── Init Vertex AI / Gemini ───
vertexai.init(project=PROJECT_ID, location=REGION)
model = GenerativeModel("gemini-2.5-flash")

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
Keep responses concise (2-3 sentences max).

User message: {message}"""


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


def store_receipt(data: dict, telegram_user: str, firebase_uid: str) -> str:
    """Store receipt to Firestore using deterministic ID to prevent duplicates."""
    store = data.get('store', 'Unknown')
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    amount = float(data.get('amount', 0))
    
    unique_string = f"{store.strip().lower()}_{date.strip()}_{amount}"
    doc_id = hashlib.md5(unique_string.encode('utf-8')).hexdigest()
    
    doc_ref = db.collection('receipts').document(doc_id)
    doc_ref.set({
        'store': store,
        'date': date,
        'amount': amount,
        'category': data.get('category', 'Uncategorized'),
        'description': data.get('description', ''),
        'source': 'telegram',
        'telegram_user': telegram_user,
        'user_id': firebase_uid,
        'status': 'processed' if amount < 500 else 'needs_approval',
        'created_at': firestore.SERVER_TIMESTAMP,
    })
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

        # Store to Firestore
        doc_id = store_receipt(data, username, firebase_uid)

        # Format response
        amount = float(data.get('amount', 0))
        status = "⚠️ Needs Approval (>$500)" if amount >= 500 else "✅ Processed"

        reply = (
            f"*🧾 Receipt Processed\\!*\n\n"
            f"🏪 *Store:* {_escape(data.get('store', 'Unknown'))}\n"
            f"📅 *Date:* {_escape(data.get('date', 'N/A'))}\n"
            f"💰 *Amount:* \\${amount:.2f}\n"
            f"🏷️ *Category:* {_escape(data.get('category', 'Uncategorized'))}\n"
            f"📝 *Items:* {_escape(data.get('description', 'N/A'))}\n\n"
            f"*Status:* {_escape(status)}\n"
            f"🗂️ _Saved to dashboard \\(ID: {doc_id[:8]}\\.\\.\\.\\)_"
        )
        await bot.send_message(chat_id, reply, parse_mode=ParseMode.MARKDOWN_V2)

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
        response = model.generate_content(TEXT_PROMPT.format(message=text))
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
