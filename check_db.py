import firebase_admin
from firebase_admin import firestore
import json

app = firebase_admin.initialize_app()
db = firestore.client()

docs = db.collection('receipts').order_by('created_at', direction=firestore.Query.DESCENDING).limit(5).stream()
out = []
for doc in docs:
    d = doc.to_dict()
    d['id'] = doc.id
    if 'created_at' in d:
        d['created_at'] = str(d['created_at'])
    out.append(d)

with open('db_output.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2)
