// utils/projectRepository.js
import { supabase } from './supabaseClient'
import { getCurrentUserId, isUnauthenticated } from './authCache'
import { handleUnauthorized } from './session'

const TABLE = 'projects'

function getClient() {
  return supabase
}

// List all projects for the current user.
export async function listProjects() {
  if (isUnauthenticated()) return []
  try {
    const supabase = getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return []
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, name, created_at, updated_at')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (error) throw error
    return data ?? []
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return []
  }
}

// Create a new project (enforces unique name per user).
export async function createProject(name, data = {}) {
  if (isUnauthenticated()) return null
  try {
    const supabase = await getClient()
    const now = new Date().toISOString()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return null

    // Enforce uniqueness per (user_id, name) before insert
    const { data: existing, error: existingError } = await supabase
      .from(TABLE)
      .select('id')
      .eq('name', name)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingError) throw existingError
    if (existing) throw new Error('Project name must be unique')

    const payload = {
      name,
      created_at: now,
      updated_at: now,
      user_id: userId,
      ...data,
    }

    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    return inserted
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

// Read a project by ID (scoped to current user).
export async function readProject(id) {
  if (!id) throw new Error('id required')
  if (isUnauthenticated()) return null
  try {
    const supabase = await getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return null
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

// Update a project by ID (name, etc.). Returns updated row.
export async function updateProject(id, data) {
  if (!id) throw new Error('id required')
  if (isUnauthenticated()) return null
  try {
    const supabase = await getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return null

    // If name is changing, enforce per-user uniqueness
    if (typeof data.name === 'string' && data.name.trim()) {
      const { data: existing, error: existingError } = await supabase
        .from(TABLE)
        .select('id')
        .eq('name', data.name)
        .eq('user_id', userId)
        .neq('id', id)
        .maybeSingle()
      if (existingError) throw existingError
      if (existing) throw new Error('Project name must be unique')
    }

    const { data: result, error } = await supabase
      .from(TABLE)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw error
    return result
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

// Delete a project by ID.
export async function deleteProject(id) {
  if (!id) throw new Error('id required')
  if (isUnauthenticated()) return false
  try {
    const supabase = await getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return false
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return true
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return false
  }
}
