import { supabase } from './supabaseClient.js'

export function signUp(email, password) {
  return supabase.auth.signUp({ email, password })
}

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export function signOut() {
  return supabase.auth.signOut()
}
