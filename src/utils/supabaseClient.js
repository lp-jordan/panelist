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

export async function getSupabase() {
  console.log('Fetching current Supabase session')
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) {
    console.error('Error retrieving session:', error)
    throw error
  }
  if (!session) {
    console.warn('No active session found')
    throw new Error('User is not logged in')
  }
  console.log('Supabase session found for user', session.user?.id)
  return supabase
}
