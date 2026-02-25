const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const app = initializeApp();
const db = getFirestore();

async function check() {
    const snapshot = await db.collection('receipts').get();
    console.log(`Found ${snapshot.size} receipts.`);
    snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}

check().catch(console.error);
