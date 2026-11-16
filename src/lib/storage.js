// Storage paths are `userId/folderId/filename`. The first segment must be the
// user's id (storage RLS checks it). New uploads use a random folder id so a
// file isn't tied to any corpus and same-named files never collide.
export function resourcePath(userId, folderId, filename) {
  return `${userId}/${folderId}/${filename}`
}

export async function uploadResource(supabase, userId, file) {
  const path = resourcePath(userId, crypto.randomUUID(), file.name)
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
