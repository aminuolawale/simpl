// Where a resource's PDF comes from: the device cache when it's there,
// otherwise Supabase Storage. Downloads use the signed-in user's token
// directly (the authenticated object endpoint), which saves the extra round
// trip of asking for a signed URL first.
import { supabase } from './supabase'
import { getCachedPdf, hasCachedPdf, putCachedPdf } from './pdfCache'

const BUCKET = 'resources'

export function resourceFileUrl(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${encoded}`
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
}

// Downloads in progress, by path, so a prefetch and an open share one download.
const downloads = new Map()

// Download a resource's PDF into the device cache ahead of opening it.
// Safe to call repeatedly; does nothing if it's cached or downloading.
export function prefetchResourcePdf(path) {
  if (!path || downloads.has(path)) return downloads.get(path) ?? Promise.resolve()
  if (navigator.connection?.saveData) return Promise.resolve()
  const job = (async () => {
    if (await hasCachedPdf(path)) return
    const res = await fetch(resourceFileUrl(path), { headers: await authHeaders() })
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    await putCachedPdf(path, await res.blob())
  })()
    .catch(() => {}) // best effort; opening the PDF falls back to the network
    .finally(() => downloads.delete(path))
  downloads.set(path, job)
  return job
}

// → { source, cached } where source is pdf.js getDocument params.
export async function resolveResourcePdf(path) {
  // A download already under way (e.g. started on the study page) is further
  // along than a new one would be, so wait for it.
  if (downloads.has(path)) await downloads.get(path)
  const blob = await getCachedPdf(path)
  if (blob) return { source: { data: new Uint8Array(await blob.arrayBuffer()) }, cached: true }
  return { source: { url: resourceFileUrl(path), httpHeaders: await authHeaders() }, cached: false }
}

// After a PDF was opened from the network, keep its bytes for next time.
export function cacheOpenedPdf(path, pdfDoc) {
  pdfDoc.getData()
    .then(bytes => putCachedPdf(path, new Blob([bytes], { type: 'application/pdf' })))
    .catch(() => {})
}
