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
    type DocumentData,
    type QuerySnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Receipt {
    id: string;
    store?: string;
    date?: string;
    amount?: number;
    category?: string;
    status: string;
    image_url?: string;
    gcs_uri?: string;
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

        // Handle duplicates: alert user and delete the document so it is not saved
        const duplicates = receipts.filter(r => r.status === "duplicate");
        if (duplicates.length > 0) {
            // Use setTimeout to ensure the alert doesn't block the render cycle
            setTimeout(() => {
                alert("⚠️ This receipt appears to be a duplicate and has already been processed!");
            }, 100);

            duplicates.forEach(d => {
                deleteDoc(doc(db, "receipts", d.id)).catch(console.error);
            });
        }

        // Filter out duplicates from the returned list
        receipts = receipts.filter(r => r.status !== "duplicate");

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
