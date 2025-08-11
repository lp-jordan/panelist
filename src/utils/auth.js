import { supabase } from './supabaseClient.js'
import { clearCachedUserId } from './authCache.js'
import { logger } from './logger.js'

export async function signUp(email, password) {
  logger.log('Attempting signUp for', email)
  try {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      logger.error('signUp error:', error)
    } else {
      logger.log('signUp success for user', data.user?.id)
    }
    return { data, error }
  } catch (error) {
    logger.error('unexpected signUp error:', error)
    return { data: null, error }
  }
}

export async function signIn(email, password) {
  logger.log('Attempting signIn for', email)
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      logger.error('signIn error:', error)
    } else {
      logger.log('signIn success for user', data.user?.id)
    }
    return { data, error }
  } catch (error) {
    logger.error('unexpected signIn error:', error)
    return { data: null, error }
  }
}

export async function signOut() {
  logger.log('Signing out current user')
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      logger.error('signOut error:', error)
    } else {
      logger.log('signOut success')
    }
    clearCachedUserId()
    return { data: null, error }
  } catch (error) {
    logger.error('unexpected signOut error:', error)
    clearCachedUserId()
    return { data: null, error }
  }
}
