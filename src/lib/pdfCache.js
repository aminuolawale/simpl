// PDF files kept on this device (IndexedDB), so reopening a book needs no
// download. Keyed by storage path: every upload gets a unique path, so a
// cached file never goes stale. Least recently used files are evicted past
// MAX_BYTES. Every operation is best effort: if storage is unavailable
// (private window, quota, blocked), callers just fall back to the network.

const DB_NAME = 'simpl-pdf-cache'
const STORE = 'files'
const MAX_BYTES = 500 * 1024 * 1024

let dbPromise = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'path' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).catch((e) => {
      dbPromise = null
      throw e
    })
  }
  return dbPromise
}

// Runs fn(store) in a transaction; resolves with the result of the request
// fn returns (undefined when there isn't one, or nothing was found).
function run(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request instanceof IDBRequest ? request.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }))
}

// → Blob or null
export async function getCachedPdf(path) {
  try {
    const record = await run('readonly', store => store.get(path))
    if (!record) return null
    // Mark as recently used (not awaited).
    run('readwrite', store => store.put({ ...record, usedAt: Date.now() })).catch(() => {})
    return record.blob
  } catch {
    return null
  }
}

export async function hasCachedPdf(path) {
  try {
    return !!(await run('readonly', store => store.getKey(path)))
  } catch {
    return false
  }
}

export async function putCachedPdf(path, blob) {
  try {
    if (blob.size > MAX_BYTES) return
    await run('readwrite', store => store.put({ path, blob, size: blob.size, usedAt: Date.now() }))
    requestPersistence()
    await evict()
  } catch {}
}

export async function deleteCachedPdf(path) {
  try { await run('readwrite', store => store.delete(path)) } catch {}
}

export async function clearPdfCache() {
  try { await run('readwrite', store => store.clear()) } catch {}
}

// Drop least recently used files until the cache fits.
async function evict() {
  const records = await run('readonly', store => store.getAll())
  let total = records.reduce((n, r) => n + (r.size || 0), 0)
  if (total <= MAX_BYTES) return
  const oldest = records.sort((a, b) => a.usedAt - b.usedAt)
  await run('readwrite', store => {
    for (const r of oldest) {
      if (total <= MAX_BYTES) break
      store.delete(r.path)
      total -= r.size || 0
    }
  })
}

// Ask the browser not to clear the cache under storage pressure (once).
let persistenceRequested = false
function requestPersistence() {
  if (persistenceRequested) return
  persistenceRequested = true
  navigator.storage?.persist?.().catch(() => {})
}
