import { clearCachedUserId } from './authCache.js'

async function getClient() {
  try {
    const { supabase } = await import('./supabaseClient.js')
    return supabase
  } catch (error) {
    console.error('Failed to load Supabase client:', error?.message || error)
    throw error
  }
}

export async function signUp(email, password) {
  try {
    console.log('Attempting signUp for', email)
    const supabase = await getClient()
    const result = await supabase.auth.signUp({ email, password })
    if (result.error) {
      console.error('signUp error:', result.error)
    } else {
      console.log('signUp success for user', result.data.user?.id)
    }
    return result
  } catch (error) {
    console.error('unexpected signUp error:', error)
    return { data: null, error }
  }
}

export async function signIn(email, password) {
  try {
    console.log('Attempting signIn for', email)
    const supabase = await getClient()
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      console.error('signIn error:', result.error)
    } else {
      console.log('signIn success for user', result.data.user?.id)
    }
    return result
  } catch (error) {
    console.error('unexpected signIn error:', error)
    return { data: null, error }
  }
}

export async function signOut() {
  try {
    console.log('Signing out current user')
    const supabase = await getClient()
    const result = await supabase.auth.signOut()
    if (result.error) {
      console.error('signOut error:', result.error)
    } else {
      console.log('signOut success')
    }
    clearCachedUserId()
    return result
  } catch (error) {
    console.error('unexpected signOut error:', error)
    clearCachedUserId()
    return { error }
  }
}
