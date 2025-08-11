export let cachedUserId = null

export function setCachedUserId(id) {
  cachedUserId = id
}

export async function getCurrentUserId() {
  return cachedUserId
}

export function clearCachedUserId() {
  cachedUserId = null
  checkedUnauthenticated = false
}

export function isUnauthenticated() {
  return checkedUnauthenticated
}
