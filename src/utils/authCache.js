let cachedUserId = null

export async function getCurrentUserId(supabase) {
  if (cachedUserId) return cachedUserId
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) {
    cachedUserId = null
    throw error
  }
  if (!user) {
    cachedUserId = null
    return null
  }
  cachedUserId = user.id
  return cachedUserId
}

export function clearCachedUserId() {
  cachedUserId = null
}
