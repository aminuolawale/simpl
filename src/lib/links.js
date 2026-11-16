// Linking and unlinking entities. See supabase/migrations/002_standalone_entities.sql:
//   resource ⇄ corpus   many-to-many (corpus_resources)
//   study → corpus      at most one (studies.corpus_id)
//   session → study     at most one, same resource as the study
//   note → session      at most one note per session
//   note → resource     optional reference

async function update(supabase, table, id, values) {
  const { error, count } = await supabase
    .from(table)
    .update(values, { count: 'exact' })
    .eq('id', id)
  if (error) throw error
  if (count === 0) throw new Error('Nothing was updated. It may have been deleted.')
}

export async function linkResource(supabase, corpusId, resourceId) {
  const { error } = await supabase
    .from('corpus_resources')
    .upsert({ corpus_id: corpusId, resource_id: resourceId }, { ignoreDuplicates: true })
  if (error) throw error
}

export async function linkResources(supabase, corpusId, resourceIds) {
  if (resourceIds.length === 0) return
  const { error } = await supabase
    .from('corpus_resources')
    .upsert(
      resourceIds.map(resource_id => ({ corpus_id: corpusId, resource_id })),
      { ignoreDuplicates: true }
    )
  if (error) throw error
}

export async function unlinkResource(supabase, corpusId, resourceId) {
  const { error } = await supabase
    .from('corpus_resources')
    .delete()
    .eq('corpus_id', corpusId)
    .eq('resource_id', resourceId)
  if (error) throw error
}

export const setStudyCorpus = (supabase, studyId, corpusId) =>
  update(supabase, 'studies', studyId, { corpus_id: corpusId ?? null })

export const setSessionStudy = (supabase, sessionId, studyId) =>
  update(supabase, 'reading_sessions', sessionId, { study_id: studyId ?? null })

export async function attachNote(supabase, noteId, sessionId) {
  try {
    await update(supabase, 'notes', noteId, { reading_session_id: sessionId ?? null })
  } catch (e) {
    // unique violation on notes.reading_session_id
    if (e?.code === '23505') throw new Error('That session already has a note.')
    throw e
  }
}

export const setNoteResource = (supabase, noteId, resourceId) =>
  update(supabase, 'notes', noteId, { resource_id: resourceId ?? null })
