// Deletion helpers. What the database cascades (see 002_standalone_entities.sql):
//   corpus   → only its links to resources; its studies become standalone
//   resource → studies that read it, and their sessions; notes keep living without it
//   study    → its sessions → their notes
//   session  → its note
// Storage objects are not cascaded, so PDFs are removed explicitly.

import { notifyDataChanged } from './events'
import { deleteCachedPdf } from './pdfCache'

const BUCKET = 'resources'

async function deleteRow(supabase, table, column, value) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value)
  if (error) throw error
  if (count === 0) throw new Error('Nothing was deleted. It may already be gone.')
  notifyDataChanged()
}

// Best effort: the row is already gone, so a leftover file must not block the UI.
async function removeFiles(supabase, paths) {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(unique)
  if (error) console.warn('Could not remove stored files', unique, error)
}

export const deleteCorpus = (supabase, corpusId) =>
  deleteRow(supabase, 'corpora', 'id', corpusId)

export async function deleteResource(supabase, resourceId) {
  const { data, error } = await supabase
    .from('resources')
    .select('storage_path')
    .eq('id', resourceId)
    .single()
  if (error) throw error
  await deleteRow(supabase, 'resources', 'id', resourceId)
  if (data?.storage_path) deleteCachedPdf(data.storage_path)
  await removeFiles(supabase, [data?.storage_path])
}

export const deleteStudy = (supabase, studyId) =>
  deleteRow(supabase, 'studies', 'id', studyId)

export const deleteSession = (supabase, sessionId) =>
  deleteRow(supabase, 'reading_sessions', 'id', sessionId)

export const deleteNote = (supabase, noteId) =>
  deleteRow(supabase, 'notes', 'id', noteId)

// For confirmation messages: plural(2, 'study', 'studies') → '2 studies'
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Builds the confirmation message for deleting a resource, which also removes
// the studies and reading sessions that read it.
export async function resourceDeleteMessage(supabase, resource) {
  const [{ count: studies }, { count: sessions }] = await Promise.all([
    supabase.from('studies').select('id', { count: 'exact', head: true }).eq('resource_id', resource.id),
    supabase.from('reading_sessions').select('id, studies!inner(resource_id)', { count: 'exact', head: true }).eq('studies.resource_id', resource.id),
  ])
  const parts = []
  if (studies) parts.push(plural(studies, 'study', 'studies'))
  if (sessions) parts.push(plural(sessions, 'reading session'))
  return parts.length
    ? `“${resource.name}” will be deleted everywhere, along with ${parts.join(' and ')} that read it and their notes.`
    : `“${resource.name}” will be deleted everywhere it is used.`
}
