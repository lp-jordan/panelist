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
