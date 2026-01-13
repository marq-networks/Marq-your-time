
const DB_NAME = 'marq-offline-db'
const STORE_ACTIVITY = 'activity_queue'
const STORE_TIME = 'time_queue'
const VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result as IDBDatabase
      if (!db.objectStoreNames.contains(STORE_ACTIVITY)) {
        db.createObjectStore(STORE_ACTIVITY, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORE_TIME)) {
        db.createObjectStore(STORE_TIME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveOfflineActivity(item: any) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITY, 'readwrite')
    const store = tx.objectStore(STORE_ACTIVITY)
    store.add({ ...item, savedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getOfflineActivity() {
  const db = await openDB()
  return new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITY, 'readonly')
    const store = tx.objectStore(STORE_ACTIVITY)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function clearOfflineActivity(ids: number[]) {
  const db = await openDB()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ACTIVITY, 'readwrite')
    const store = tx.objectStore(STORE_ACTIVITY)
    ids.forEach(id => store.delete(id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
