import { uploadResource } from './storage'
import { extractOutline } from './pdf'

// Uploads a PDF and creates a standalone resource row for it.
export async function createResource(supabase, file) {
  if (!file || file.type !== 'application/pdf') throw new Error('Please choose a PDF file.')
  const { data: { user } } = await supabase.auth.getUser()
  const [path, outline] = await Promise.all([
    uploadResource(supabase, user.id, file),
    extractOutline(file),
  ])
  const { data, error } = await supabase
    .from('resources')
    .insert({ user_id: user.id, name: file.name, storage_path: path, size_bytes: file.size, outline })
    .select('id, name, size_bytes, created_at')
    .single()
  if (error) {
    await supabase.storage.from('resources').remove([path])
    throw error
  }
  return data
}

export async function currentUserId(supabase) {
  const { data: { user } } = await supabase.auth.getUser()
  return user.id
}
