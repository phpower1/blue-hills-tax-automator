import firebase_admin
from firebase_admin import firestore
import json

if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

docs = db.collection('receipts').stream()
output = []
for doc in docs:
    data = doc.to_dict()
    # convert datetime to string if there are any
    data['id'] = doc.id
    if 'created_at' in data:
        data['created_at'] = str(data['created_at'])
    output.append({
        'id': doc.id,
        'status': data.get('status'),
        'store': data.get('store'),
        'amount': data.get('amount'),
        'date': data.get('date')
    })

with open('db_receipts.json', 'w') as f:
    json.dump(output, f, indent=2)
