import { currentUserId } from './resources'
import { notifyDataChanged } from './events'

// Plain-text preview of a TipTap/ProseMirror JSON document.
export function notePreview(content, max = 120) {
  if (!content?.content) return ''
  const texts = []
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.text) texts.push(n.text)
      if (n.content) walk(n.content)
    }
  }
  walk(content.content)
  const full = texts.join(' ')
  return full.length > max ? full.slice(0, max) + '…' : full
}

export const noteTitle = (note) => note?.title?.trim() || 'Untitled note'

// Creates an empty standalone note and returns its id.
export async function createNote(supabase) {
  const user_id = await currentUserId(supabase)
  const { data, error } = await supabase.from('notes').insert({ user_id }).select('id').single()
  if (error) throw error
  notifyDataChanged()
  return data.id
}
