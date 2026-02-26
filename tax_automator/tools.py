import firebase_admin
from firebase_admin import firestore
from typing import Optional
import hashlib

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
                
            if existing_amount == current_amount and doc_data.get('store', '').lower() == store.lower():
                doc_ref.update({
                    'status': 'duplicate',
                    'store': store,
                    'date': date,
                    'amount': amount,
                    'category': category
                })
                return f"Duplicate receipt detected. Handled as 'duplicate'. Original ID: {doc.id}"

    doc_ref.update({
        'store': store,
        'date': date,
        'amount': amount,
        'category': category,
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
