import {
    collection,
    query,
    orderBy,
    onSnapshot,
    where,
    Timestamp,
    getDocs,
    limit,
    deleteDoc,
    doc,
    updateDoc,
    type DocumentData,
    type QuerySnapshot,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";

export interface Receipt {
    id: string;
    store?: string;
    date?: string;
    amount?: number;
    category?: string;
    status: string;
    image_url?: string;
    gcs_uri?: string;
    description?: string;
    original_filename?: string;
    error?: string;
    created_at?: Timestamp;
}

function docToReceipt(id: string, data: DocumentData): Receipt {
    return {
        id,
        store: data.store ?? "",
        date: data.date ?? "",
        amount: data.amount ?? 0,
        category: data.category ?? "Uncategorized",
        status: data.status ?? "unknown",
        image_url: data.image_url ?? "",
        gcs_uri: data.gcs_uri ?? "",
        description: data.description ?? "",
        original_filename: data.original_filename ?? "",
        error: data.error ?? "",
        created_at: data.created_at,
    };
}

export function subscribeToReceipts(
    userId: string,
    callback: (receipts: Receipt[]) => void
): () => void {
    const q = query(
        collection(db, "receipts"),
        where("user_id", "==", userId)
    );

    return onSnapshot(q, (snapshot: QuerySnapshot) => {
        let receipts = snapshot.docs.map((doc) =>
            docToReceipt(doc.id, doc.data())
        );

        // Filter out any duplicates from the list provided to the UI
        receipts = receipts.filter(r => r.status !== 'duplicate');

        // Sort by created_at descending in memory
        receipts.sort((a, b) => {
            const timeA = a.created_at?.toMillis() || 0;
            const timeB = b.created_at?.toMillis() || 0;
            return timeB - timeA;
        });
        callback(receipts);
    });
}

export function subscribeToReceiptsByStatus(
    userId: string,
    status: string,
    callback: (receipts: Receipt[]) => void
): () => void {
    const q = query(
        collection(db, "receipts"),
        where("user_id", "==", userId),
        where("status", "==", status)
    );

    return onSnapshot(q, (snapshot: QuerySnapshot) => {
        const receipts = snapshot.docs.map((doc) =>
            docToReceipt(doc.id, doc.data())
        );
        callback(receipts);
    });
}

export async function getSpendingSummary(userId: string, startDate?: string, endDate?: string) {
    let q = query(
        collection(db, "receipts"),
        where("user_id", "==", userId)
    );
    if (startDate) {
        q = query(q, where("date", ">=", startDate));
    }
    if (endDate) {
        q = query(q, where("date", "<=", endDate));
    }
    const snapshot = await getDocs(q);
    const receipts = snapshot.docs.map(doc => docToReceipt(doc.id, doc.data()));

    let total = 0;
    const byCategory: Record<string, number> = {};
    for (const r of receipts) {
        if (r.status === 'duplicate') continue;
        if (r.amount) {
            total += r.amount;
            const cat = r.category || "Uncategorized";
            byCategory[cat] = (byCategory[cat] || 0) + r.amount;
        }
    }
    return {
        total_spent: total,
        by_category: byCategory,
        receipt_count: receipts.length
    };
}

export async function getRecentReceipts(userId: string, limitCount: number = 5) {
    const q = query(
        collection(db, "receipts"),
        where("user_id", "==", userId),
        orderBy("created_at", "desc"),
        limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const r = docToReceipt(doc.id, doc.data());
        return {
            store: r.store,
            date: r.date,
            amount: r.amount,
            category: r.category
        };
    });
}

export async function deleteReceipt(receipt: Receipt): Promise<void> {
    // Delete image from Storage if it exists
    if (receipt.gcs_uri) {
        try {
            // gcs_uri format: gs://bucket-name/path/to/file
            const path = receipt.gcs_uri.replace(/^gs:\/\/[^/]+\//, "");
            const storageRef = ref(storage, path);
            await deleteObject(storageRef);
        } catch (err: any) {
            // Ignore "object not found" errors — image may already be deleted
            if (err?.code !== "storage/object-not-found") {
                console.error("Error deleting image from storage:", err);
            }
        }
    }

    // Delete Firestore document
    await deleteDoc(doc(db, "receipts", receipt.id));
}

export async function updateReceipt(id: string, updates: Partial<Receipt>): Promise<void> {
    const receiptRef = doc(db, "receipts", id);
    await updateDoc(receiptRef, updates);
}
