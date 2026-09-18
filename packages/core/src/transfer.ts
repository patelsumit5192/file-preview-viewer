/**
 * IndexedDB and in-memory document transfer utility for cross-window preview opening.
 */

export interface TransferPayload {
  buffer: ArrayBuffer;
  metadata?: {
    name?: string;
    extension?: string;
    mimeType?: string;
    size?: number;
  };
  options?: Record<string, any>;
}

const DB_NAME = 'PreviewFileTransferDB';
const DB_STORE = 'transfers';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available'));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save file payload to IndexedDB and window storage for cross-window retrieval.
 */
export async function saveTransferPayload(id: string, payload: TransferPayload): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      (window as any)[id] = payload;
      (window as any).__lastTransfer = payload;
    } catch {}
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      store.put({ id, ...payload, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[saveTransferPayload] IndexedDB store warning:', e);
  }
}

/**
 * Retrieve transferred file payload from opener window or IndexedDB.
 */
export async function getTransferPayload(id: string): Promise<TransferPayload | null> {
  if (typeof window !== 'undefined') {
    try {
      if (window.opener && (window.opener as any)[id]) {
        return (window.opener as any)[id];
      }
      if ((window as any)[id]) {
        return (window as any)[id];
      }
      if (window.opener && (window.opener as any).__lastTransfer) {
        return (window.opener as any).__lastTransfer;
      }
      if ((window as any).__lastTransfer) {
        return (window as any).__lastTransfer;
      }
    } catch {}
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.buffer) {
          resolve({
            buffer: req.result.buffer,
            metadata: req.result.metadata,
            options: req.result.options
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
