import { emptyInventoryState, type InventoryState } from "@/lib/wms/inventory";
import type { InventoryRepository } from "@/lib/wms/inventory-repository";

const DB_NAME = "wms";
const DB_VERSION = 1;
const STORE_NAME = "inventory";
const KEY = "current";

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

export class IndexedDbInventoryRepository implements InventoryRepository {
  async load(): Promise<InventoryState> {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return emptyInventoryState;
    }

    const db = await openDb();

    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(KEY);

        request.onsuccess = () => {
          const state = request.result as InventoryState | undefined;
          resolve(state ?? emptyInventoryState);
        };
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  async save(state: InventoryState): Promise<void> {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return;
    }

    const db = await openDb();

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(state, KEY);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return;
    }

    const db = await openDb();

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(KEY);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}
