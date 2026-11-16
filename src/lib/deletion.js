// Deletion helpers. The database cascades child rows (see 001_schema.sql):
//   corpora → resources → studies → reading_sessions → notes
// Storage objects are not cascaded, so PDFs are removed explicitly.

const BUCKET = 'resources'

async function deleteRow(supabase, table, column, value, { allowMissing = false } = {}) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value)
  if (error) throw error
  if (count === 0 && !allowMissing) throw new Error('Nothing was deleted. It may already be gone.')
}

// Best effort: the row is already gone, so a leftover file must not block the UI.
async function removeFiles(supabase, paths) {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(unique)
  if (error) console.warn('Could not remove stored files', unique, error)
}

export async function deleteCorpus(supabase, corpusId) {
  const { data, error } = await supabase
    .from('resources')
    .select('storage_path')
    .eq('corpus_id', corpusId)
  if (error) throw error
  await deleteRow(supabase, 'corpora', 'id', corpusId)
  await removeFiles(supabase, (data ?? []).map(r => r.storage_path))
}

export async function deleteResource(supabase, resourceId) {
  const { data, error } = await supabase
    .from('resources')
    .select('storage_path')
    .eq('id', resourceId)
    .single()
  if (error) throw error
  await deleteRow(supabase, 'resources', 'id', resourceId)
  await removeFiles(supabase, [data?.storage_path])
}

export const deleteStudy = (supabase, studyId) =>
  deleteRow(supabase, 'studies', 'id', studyId)

export const deleteSession = (supabase, sessionId) =>
  deleteRow(supabase, 'reading_sessions', 'id', sessionId)

// A session may never have had a note saved; that still counts as deleted.
export const deleteNote = (supabase, sessionId) =>
  deleteRow(supabase, 'notes', 'reading_session_id', sessionId, { allowMissing: true })

// For confirmation messages: plural(2, 'study', 'studies') → '2 studies'
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
