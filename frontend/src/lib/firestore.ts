import {
    collection,
    query,
    orderBy,
    onSnapshot,
    where,
    Timestamp,
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
    callback: (receipts: Receipt[]) => void
): () => void {
    const q = query(collection(db, "receipts"), orderBy("__name__", "desc"));

    return onSnapshot(q, (snapshot: QuerySnapshot) => {
        const receipts = snapshot.docs.map((doc) =>
            docToReceipt(doc.id, doc.data())
        );
        callback(receipts);
    });
}

export function subscribeToReceiptsByStatus(
    status: string,
    callback: (receipts: Receipt[]) => void
): () => void {
    const q = query(
        collection(db, "receipts"),
        where("status", "==", status)
    );

    return onSnapshot(q, (snapshot: QuerySnapshot) => {
        const receipts = snapshot.docs.map((doc) =>
            docToReceipt(doc.id, doc.data())
        );
        callback(receipts);
    });
}
