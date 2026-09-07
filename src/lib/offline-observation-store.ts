import type { ObservationDraft } from '../domain/types'

const databaseName = 'streex-garden'
const databaseVersion = 2
const storeName = 'observation-drafts'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(storeName, mode)
    } catch (reason) {
      database.close()
      reject(reason)
      return
    }
    const request = action(transaction.objectStore(storeName))
    request.onerror = () => reject(request.error)
    transaction.onabort = () => reject(transaction.error)
    transaction.oncomplete = () => {
      database.close()
      resolve(request.result)
    }
  })
}

export function saveObservationDraft(draft: ObservationDraft): Promise<IDBValidKey> {
  return withStore('readwrite', (store) => store.put(draft))
}

export function getObservationDrafts(): Promise<ObservationDraft[]> {
  return withStore('readonly', (store) => store.getAll())
}

export function deleteObservationDraft(id: string): Promise<undefined> {
  return withStore('readwrite', (store) => store.delete(id))
}

export function clearObservationDrafts(): Promise<undefined> {
  return withStore('readwrite', (store) => store.clear())
}
