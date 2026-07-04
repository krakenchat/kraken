/**
 * Tiny IndexedDB key/value store shared between the window (React app) and the
 * service worker.
 *
 * Why not localStorage? The service worker has no access to localStorage, but
 * both contexts can reach IndexedDB. This module uses only the plain
 * `indexedDB` global (available in both Window and ServiceWorkerGlobalScope)
 * and has zero dependencies, so it can be imported from `sw-custom.ts` as well
 * as from ordinary app code.
 *
 * It stores small PWA/push bookkeeping values (the VAPID application server
 * key, the API base URL, and push-subscription endpoint markers) so the
 * `pushsubscriptionchange` SW handler can re-subscribe, and so the app can
 * detect a rotated subscription on startup and re-sync it to the backend.
 */

const DB_NAME = 'semaphore-pwa';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Read a value by key. Resolves to `null` when absent (or on any error). */
export async function swDbGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Write a value by key. `null` clears the key. Best-effort (never throws). */
export async function swDbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (value === null || value === undefined) {
        store.delete(key);
      } else {
        store.put(value, key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort: storage failures must never break push/PWA flows.
  }
}

/** Delete a value by key. Best-effort (never throws). */
export async function swDbDelete(key: string): Promise<void> {
  return swDbSet(key, null);
}

// Well-known keys used across the window/SW boundary.
export const SW_DB_KEYS = {
  applicationServerKey: 'push:applicationServerKey',
  lastSyncedEndpoint: 'push:lastSyncedEndpoint',
  pendingEndpoint: 'push:pendingEndpoint',
} as const;
