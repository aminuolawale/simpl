export function resourcePath(userId, corpusId, filename) {
  return `${userId}/${corpusId}/${filename}`
}

export async function uploadResource(supabase, userId, corpusId, file) {
  const path = resourcePath(userId, corpusId, file.name)
  const { error } = await supabase.storage.from('resources').upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

export async function getSignedUrl(supabase, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('resources')
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}
