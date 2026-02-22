import firebase_admin
from firebase_admin import firestore
from typing import Optional


# Initialize Firestore
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()


def store_receipt_to_firestore(
    store: str,
    date: str,
    amount: float,
    category: str,
    image_url: Optional[str] = None
) -> str:
    """
    Saves receipt metadata and optional image URL to Firestore.

    Args:
        store: The name of the store or vendor.
        date: The date of the transaction (YYYY-MM-DD).
        amount: The total amount of the transaction.
        category: The potential tax category.
        image_url: The URL of the receipt image in Google Cloud Storage (optional).

    Returns:
        The ID of the created document in Firestore.
    """
    doc_ref = db.collection('receipts').document()
    doc_ref.set({
        'store': store,
        'date': date,
        'amount': amount,
        'category': category,
        'image_url': image_url,
        'status': 'processed' if amount < 500 else 'needs_approval'
    })
    return f"Receipt stored successfully with ID: {doc_ref.id}"


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
