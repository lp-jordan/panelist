import { clearCachedUserId } from './authCache'

export function handleUnauthorized(error) {
  if (error?.status === 401 || error?.message?.includes('not logged in')) {
    clearCachedUserId()
    window.location.reload()
    return true
  }
  return false
}
