/**
 * IndexedDB, wrapped thinly. No dependency.
 *
 * Not localStorage: at roughly 200 bytes a set and a few thousand sets a year, localStorage
 * would survive a few years and then start throwing QuotaExceededError mid-workout. It is
 * also synchronous, which means every write blocks the main thread on the one screen that
 * must never stutter. Settings stay in localStorage, where a synchronous first paint helps.
 *
 * On iOS, script-writable storage is evicted after 7 days of no use -- for a training app
 * with a deload week that is data loss, not an edge case. Home-screen-installed PWAs are
 * documented as exempt, which is why the install prompt is load-bearing here and not
 * cosmetic. Verify on a real device before anyone relies on this.
 */

const DB_NAME = "calisthenics-tree";
const DB_VERSION = 1;
export const STORE_SETS = "sets";
export const STORE_META = "meta";

let handle: Promise<IDBDatabase> | undefined;

export function openDb(): Promise<IDBDatabase> {
  if (handle) return handle;
  handle = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SETS)) {
        const sets = db.createObjectStore(STORE_SETS, { keyPath: "id" });
        sets.createIndex("stepId", "stepId", { unique: false });
        sets.createIndex("localDate", "localDate", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return handle;
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const put = <T>(store: string, value: T) => run(store, "readwrite", (s) => s.put(value));
export const getAll = <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll());
export const get = <T>(store: string, key: IDBValidKey) =>
  run<T | undefined>(store, "readonly", (s) => s.get(key));

/** Bulk put in one transaction -- used by import, which must be all-or-nothing. */
export function putAll<T>(store: string, values: readonly T[]): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const os = tx.objectStore(store);
        for (const v of values) os.put(v);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}
