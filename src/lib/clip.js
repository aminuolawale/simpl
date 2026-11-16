// Clipping equations out of a PDF and turning them into LaTeX.
//
// A clip is { id, resourceId, page, rect, image, thumb, hint } where `rect` is
// { x, y, w, h } as fractions of the page (so it doesn't depend on zoom),
// `image` is a base64 PNG for conversion, `thumb` a small data URL for display.
// Images live only in memory here, never in the note; the note keeps the
// source (resource, page, rect) so a clip can be redrawn from the PDF.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export const CLIP_MIME = 'application/x-simpl-clip'

const CLIP_LONG_SIDE = 1600 // max pixels sent for conversion
const CLIP_SHORT_MIN = 64   // small clips are upscaled at least to this
const THUMB_LONG_SIDE = 240

// ── drawing ─────────────────────────────────────────────────────────────────

// Draw just `rect` of a page, sharply, into a PNG.
export async function renderClip(pdfDoc, pageNum, rect) {
  const page = await pdfDoc.getPage(pageNum)
  const base = page.getViewport({ scale: 1 })
  const w1 = rect.w * base.width
  const h1 = rect.h * base.height
  // About 3× the page's natural size, within limits.
  let scale = 3
  scale = Math.min(scale, CLIP_LONG_SIDE / Math.max(w1, h1))
  scale = Math.max(scale, Math.min(8, CLIP_SHORT_MIN / Math.min(w1, h1)))
  const vp = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(rect.w * vp.width))
  canvas.height = Math.max(1, Math.ceil(rect.h * vp.height))
  try {
    await page.render({
      canvasContext: canvas.getContext('2d', { alpha: false }),
      viewport: vp,
      // Shift the page so the clip's corner lands at the canvas origin.
      transform: [1, 0, 0, 1, -rect.x * vp.width, -rect.y * vp.height],
    }).promise
    const image = canvas.toDataURL('image/png').split(',')[1]
    return { image, thumb: thumbnail(canvas), width: canvas.width, height: canvas.height }
  } finally {
    canvas.width = canvas.height = 0
  }
}

function thumbnail(source) {
  const k = Math.min(1, THUMB_LONG_SIDE / Math.max(source.width, source.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(source.width * k))
  c.height = Math.max(1, Math.round(source.height * k))
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, c.width, c.height)
  const url = c.toDataURL('image/png')
  c.width = c.height = 0
  return url
}

// Text the PDF has inside `rect` (often garbled for math, so only a hint).
export async function extractClipText(pdfDoc, pageNum, rect) {
  try {
    const page = await pdfDoc.getPage(pageNum)
    const base = page.getViewport({ scale: 1 })
    const { items } = await page.getTextContent()
    const words = []
    for (const item of items) {
      if (!item.str?.trim()) continue
      const [x, y] = base.convertToViewportPoint(item.transform[4], item.transform[5])
      const fx = x / base.width, fy = y / base.height
      if (fx >= rect.x && fx <= rect.x + rect.w && fy >= rect.y && fy <= rect.y + rect.h) words.push(item.str)
    }
    return words.join(' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

// Everything needed to convert a region of a page. Pass `id` to redraw a
// clip for an existing placeholder.
export async function makeClip(pdfDoc, { id = newId(), resourceId, page, rect }) {
  const [drawn, hint] = await Promise.all([
    renderClip(pdfDoc, page, rect),
    extractClipText(pdfDoc, page, rect),
  ])
  return putClip({ id, resourceId: resourceId ?? null, page, rect, hint, ...drawn })
}

export function newId() {
  return crypto.randomUUID()
}

// ── conversion ──────────────────────────────────────────────────────────────

// → { latex, display, legible }
export async function convertClip(clip) {
  const { data, error } = await supabase.functions.invoke('equation-to-latex', {
    body: { image: clip.image, hint: clip.hint || undefined },
  })
  if (error) {
    let message = null
    try { message = (await error.context?.json())?.error } catch {}
    throw new Error(message || 'Couldn’t convert the equation.')
  }
  if (typeof data?.latex !== 'string') throw new Error('Couldn’t convert the equation.')
  return data
}

// ── in-memory registry ──────────────────────────────────────────────────────

const clips = new Map()

export function putClip(clip) {
  clips.set(clip.id, clip)
  return clip
}

export function getClip(id) {
  return clips.get(id) ?? null
}

// Conversion jobs by clip id: { status: 'pending' } or { status: 'failed', message }.
// A clip with no job (e.g. after a reload) was interrupted.
const jobs = new Map()
const jobListeners = new Set()

export function setJob(id, job) {
  if (job) jobs.set(id, job)
  else jobs.delete(id)
  for (const fn of jobListeners) fn(id)
}

export function getJob(id) {
  return jobs.get(id) ?? null
}

// Tell every placeholder to redraw (e.g. when what it can offer changed).
export function refreshJobs() {
  for (const fn of jobListeners) fn(null)
}

// fn(id) on a job change; id is null when every placeholder should redraw.
export function subscribeJobs(fn) {
  jobListeners.add(fn)
  return () => jobListeners.delete(fn)
}

// ── where "Insert into note" goes ───────────────────────────────────────────
// The note editor beside the PDF registers itself; the PDF pane offers
// "Insert" only while one is registered.

let target = null
const targetListeners = new Set()

export function setClipTarget(next) {
  target = next
  for (const fn of targetListeners) fn()
  return () => {
    if (target !== next) return
    target = null
    for (const fn of targetListeners) fn()
  }
}

export function useClipTarget() {
  return useSyncExternalStore(
    (fn) => { targetListeners.add(fn); return () => targetListeners.delete(fn) },
    () => target,
  )
}
