import { getSupabase } from './supabaseClient'

const TABLE = 'projects'

function handleUnauthorized(error) {
  if (error?.status === 401 || error?.message?.includes('not logged in')) {
    window.location.reload()
    return true
  }
  return false
}

async function getCurrentUserId(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  return user.id
}

export async function listProjects() {
  try {
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { data, error } = await supabase
      .from(TABLE)
      .select('name')
      .eq('user_id', userId)
      .order('name')
    if (error) throw error
    return data ? data.map((row) => row.name) : []
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return []
  }
}

export async function createProject(name, data = {}) {
  try {
    const now = new Date().toISOString()
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
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
      ...data,
      user_id: userId,
    }
    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return inserted
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

export async function readProject(name) {
  try {
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('name', name)
      .eq('user_id', userId)
      .single()
    if (error) throw error
    return data
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

export async function updateProject(name, data) {
  try {
    const existing = await readProject(name)
    if (!existing) return null
    const updated = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
      user_id: existing.user_id,
    }
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { data: result, error } = await supabase
      .from(TABLE)
      .update(updated)
      .eq('name', name)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return result
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

export async function deleteProject(name) {
  try {
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('name', name)
      .eq('user_id', userId)
    if (error) throw error
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
  }
}
