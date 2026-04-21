const DATABASE_NAME = "endgame-grocery-offline";
const DATABASE_VERSION = 1;
const CACHE_STORE = "resource_cache";
const QUEUE_STORE = "offline_queue";
export const OFFLINE_QUEUE_CHANGED_EVENT = "endgame_grocery.offline_queue_changed";

let databasePromise;
const memoryCache = new Map();
const memoryQueue = new Map();

function supportsIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  if (!supportsIndexedDb()) {
    return Promise.resolve(null);
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(CACHE_STORE)) {
          database.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains(QUEUE_STORE)) {
          database.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });
  }

  return databasePromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function createTransactionPromise(storeName, mode, callback) {
  return openDatabase().then((database) => {
    if (!database) {
      return callback(null);
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));

      callback(store, resolve, reject);
    });
  });
}

function dispatchQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
  }
}

export async function readCachedResource(key) {
  if (!supportsIndexedDb()) {
    return memoryCache.get(key) ?? null;
  }

  const database = await openDatabase();

  if (!database) {
    return null;
  }

  const transaction = database.transaction(CACHE_STORE, "readonly");
  const store = transaction.objectStore(CACHE_STORE);
  const entry = await requestToPromise(store.get(key));

  return entry?.value ?? null;
}

export async function writeCachedResource(key, value) {
  if (!supportsIndexedDb()) {
    memoryCache.set(key, value);
    return;
  }

  await createTransactionPromise(CACHE_STORE, "readwrite", (store, resolve, reject) => {
    requestToPromise(store.put({ key, value }))
      .then(() => resolve())
      .catch(reject);
  });
}

export async function enqueueOfflineMutation(mutation) {
  if (!supportsIndexedDb()) {
    memoryQueue.set(mutation.id, mutation);
    dispatchQueueChanged();
    return;
  }

  await createTransactionPromise(QUEUE_STORE, "readwrite", (store, resolve, reject) => {
    requestToPromise(store.put(mutation))
      .then(() => {
        dispatchQueueChanged();
        resolve();
      })
      .catch(reject);
  });
}

export async function listOfflineMutations() {
  if (!supportsIndexedDb()) {
    return [...memoryQueue.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const database = await openDatabase();

  if (!database) {
    return [];
  }

  const transaction = database.transaction(QUEUE_STORE, "readonly");
  const store = transaction.objectStore(QUEUE_STORE);
  const entries = await requestToPromise(store.getAll());

  return entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function removeOfflineMutation(id) {
  if (!supportsIndexedDb()) {
    memoryQueue.delete(id);
    dispatchQueueChanged();
    return;
  }

  await createTransactionPromise(QUEUE_STORE, "readwrite", (store, resolve, reject) => {
    requestToPromise(store.delete(id))
      .then(() => {
        dispatchQueueChanged();
        resolve();
      })
      .catch(reject);
  });
}

export async function resetOfflineStateForTests() {
  memoryCache.clear();
  memoryQueue.clear();

  if (!supportsIndexedDb()) {
    return;
  }

  const database = await openDatabase();

  if (!database) {
    return;
  }

  await Promise.all([
    createTransactionPromise(CACHE_STORE, "readwrite", (store, resolve, reject) => {
      requestToPromise(store.clear())
        .then(() => resolve())
        .catch(reject);
    }),
    createTransactionPromise(QUEUE_STORE, "readwrite", (store, resolve, reject) => {
      requestToPromise(store.clear())
        .then(() => resolve())
        .catch(reject);
    })
  ]);
}
