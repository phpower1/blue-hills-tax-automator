import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "./firebase";

export interface UploadProgress {
    progress: number;
    state: "running" | "paused" | "success" | "error";
}

export async function uploadReceipt(
    file: File,
    onProgress?: (progress: UploadProgress) => void
): Promise<string> {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `receipts/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            "state_changed",
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const state =
                    snapshot.state === "running"
                        ? "running"
                        : snapshot.state === "paused"
                            ? "paused"
                            : "running";
                onProgress?.({ progress, state });
            },
            (error) => {
                onProgress?.({ progress: 0, state: "error" });
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    // Create Firestore document with status "new" to trigger the agent
                    const docRef = await addDoc(collection(db, "receipts"), {
                        status: "new",
                        original_filename: file.name,
                        gcs_uri: `gs://${storageRef.bucket}/${storagePath}`,
                        image_url: downloadURL,
                        created_at: serverTimestamp(),
                    });

                    onProgress?.({ progress: 100, state: "success" });
                    resolve(docRef.id);
                } catch (err) {
                    onProgress?.({ progress: 0, state: "error" });
                    reject(err);
                }
            }
        );
    });
}
