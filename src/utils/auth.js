import { supabase } from './supabaseClient.js'

export async function signUp(email, password) {
  try {
    const result = await supabase.auth.signUp({ email, password })
    if (result.error) {
      console.error('signUp error:', result.error)
    }
    return result
  } catch (error) {
    console.error('unexpected signUp error:', error)
    return { data: null, error }
  }
}

export async function signIn(email, password) {
  try {
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      console.error('signIn error:', result.error)
    }
    return result
  } catch (error) {
    console.error('unexpected signIn error:', error)
    return { data: null, error }
  }
}

export async function signOut() {
  try {
    const result = await supabase.auth.signOut()
    if (result.error) {
      console.error('signOut error:', result.error)
    }
    return result
  } catch (error) {
    console.error('unexpected signOut error:', error)
    return { error }
  }
}
