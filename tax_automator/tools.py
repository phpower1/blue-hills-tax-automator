import firebase_admin
from firebase_admin import firestore
from typing import Optional
import hashlib
import logging

# Initialize Firestore
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()


def store_receipt_to_firestore(
    receipt_id: str,
    date: str,
    amount: float,
    category: str,
    store: Optional[str] = "Unknown Vendor",
    description: Optional[str] = "",
    image_url: Optional[str] = None,
    user_id: Optional[str] = None
) -> str:
    """
    Saves receipt metadata and optional image URL to Firestore.

    Args:
        receipt_id: The exact ID of the original receipt document being processed.
        date: The date of the transaction (YYYY-MM-DD).
        amount: The total amount of the transaction.
        category: The potential tax category.
        store: The name of the store or vendor (optional).
        description: A brief description of the purchased items (optional).
        image_url: The URL of the receipt image in Google Cloud Storage (optional).
        user_id: The ID of the user who owns this receipt (optional).

    Returns:
        The ID of the updated document in Firestore.
    """
    doc_ref = db.collection('receipts').document(receipt_id)
    
    # Check for duplicate receipts
    if user_id:
        existing_docs = db.collection('receipts') \
            .where('user_id', '==', user_id) \
            .where('date', '==', date) \
            .stream()
        
        for doc in existing_docs:
            if doc.id == receipt_id:
                continue
            doc_data = doc.to_dict()
            # Avoid ValueError on casting amount if it's missing/bad
            try:
                existing_amount = float(doc_data.get('amount', 0))
                current_amount = float(amount)
            except (ValueError, TypeError):
                continue
                
            # Case-insensitive merchant and amount match
            existing_store = doc_data.get('store', '').lower()
            current_store = (store or "Unknown Vendor").lower()
            if existing_amount == current_amount and existing_store == current_store:
                logger = logging.getLogger(__name__)
                logger.info(f"Duplicate detected for receipt {receipt_id}. Original: {doc.id}")
                
                # Cleanup GCS image for the duplicate
                try:
                    current_doc = doc_ref.get().to_dict()
                    gcs_uri = current_doc.get('gcs_uri')
                    if gcs_uri and gcs_uri.startswith("gs://"):
                        from firebase_admin import storage
                        parts = gcs_uri.replace("gs://", "").split("/", 1)
                        bucket = storage.bucket(parts[0])
                        blob = bucket.blob(parts[1])
                        blob.delete()
                        logger.info(f"Deleted duplicate image: {gcs_uri}")
                except Exception as e:
                    logger.error(f"Failed to delete duplicate image: {e}")

                # Clear data fields and mark as duplicate
                doc_ref.set({
                    'status': 'duplicate',
                    'user_id': user_id,
                    'created_at': firestore.SERVER_TIMESTAMP
                })
                return f"Duplicate receipt detected. Image deleted and data cleared. Original ID: {doc.id}"

    doc_ref.update({
        'store': store,
        'date': date,
        'amount': amount,
        'category': category,
        'description': description,
        'status': 'processed' if float(amount) < 500 else 'needs_approval'
    })
    return f"Receipt updated successfully with ID: {doc_ref.id}"


def tax_categorizer(item_description: str, amount: float) -> str:
    """
    Assigns an IRS tax category based on the item description and amount.

    Args:
        item_description: A description of the item or service purchased.
        amount: The cost of the item.

    Returns:
        The suggested IRS tax category.
    """
    description = item_description.lower()
    
    # Simple keyword-based categorization logic
    if any(keyword in description for keyword in ['gas', 'fuel', 'oil change', 'car wash']):
        return "Auto Expenses"
    elif any(keyword in description for keyword in ['meal', 'lunch', 'dinner', 'restaurant', 'coffee']):
        return "Meals" # Note: 50% deductible usually
    elif any(keyword in description for keyword in ['hotel', 'flight', 'airbnb', 'uber', 'lyft']):
        return "Travel"
    elif any(keyword in description for keyword in ['laptop', 'monitor', 'keyboard', 'mouse', 'software', 'office']):
        return "Office Supplies"
    elif any(keyword in description for keyword in ['internet', 'phone', 'utility', 'electricity']):
        return "Utilities"
    elif any(keyword in description for keyword in ['legal', 'consulting', 'accounting']):
        return "Professional Services"
    
    return "Uncategorized"
