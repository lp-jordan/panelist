import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url) {
  console.warn('VITE_SUPABASE_URL is not defined')
}
if (!key) {
  console.warn('VITE_SUPABASE_ANON_KEY is not defined')
}

export const supabase = createClient(url, key)

// cache the session after first retrieval
let sessionCache = null
let sessionPromise = null

export async function getSupabase() {
  if (sessionCache) {
    if (import.meta.env.DEV) {
      console.debug('Using cached Supabase session')
    }
    return supabase
  }

  if (!sessionPromise) {
    if (import.meta.env.DEV) {
      console.debug('Fetching current Supabase session')
    }
    sessionPromise = supabase.auth.getSession()
  }

  const {
    data: { session },
    error,
  } = await sessionPromise
  sessionPromise = null
  if (error) {
    console.error('Error retrieving session:', error)
    throw error
  }
  if (!session) {
    console.warn('No active session found')
    throw new Error('User is not logged in')
  }

  sessionCache = session

  if (import.meta.env.DEV) {
    console.debug('Supabase session found for user', session.user?.id)
  }

  return supabase
}
