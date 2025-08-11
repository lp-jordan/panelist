let cachedUserId = null
let checkedUnauthenticated = false

export async function getCurrentUserId(supabase) {
  if (cachedUserId) return cachedUserId
  if (checkedUnauthenticated) return null
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
    checkedUnauthenticated = true
    return null
  }
  cachedUserId = user.id
  checkedUnauthenticated = false
  return cachedUserId
}

export function clearCachedUserId() {
  cachedUserId = null
  checkedUnauthenticated = false
}

export function isUnauthenticated() {
  return checkedUnauthenticated
}
