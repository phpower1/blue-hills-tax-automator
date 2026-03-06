import firebase_admin
from firebase_admin import firestore

if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

doc1 = db.collection('receipts').document('sCa3XPq9wtxOGBELtWLx')
if doc1.get().exists:
    doc1.update({'status': 'processed'})
    print("Fixed sCa3XPq9wtxOGBELtWLx")

doc2 = db.collection('receipts').document('xoft7lSsUoqNDMqWbX7W')
if doc2.get().exists:
    doc2.update({'status': 'new'})
    print("Set xoft7lSsUoqNDMqWbX7W to new")
