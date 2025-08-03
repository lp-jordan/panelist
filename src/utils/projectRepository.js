import { getSupabase } from './supabaseClient'

const TABLE = 'projects'

function handleUnauthorized(error) {
  if (error?.status === 401 || error?.message?.includes('not logged in')) {
    window.location.reload()
    return true
  }
  return false
}

export async function listProjects() {
  try {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from(TABLE)
      .select('name')
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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError) throw userError
    const payload = {
      name,
      created_at: now,
      updated_at: now,
      user_id: user.id,
      ...data,
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
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('name', name)
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
    }
    const supabase = await getSupabase()
    const { data: result, error } = await supabase
      .from(TABLE)
      .update(updated)
      .eq('name', name)
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
    const { error } = await supabase.from(TABLE).delete().eq('name', name)
    if (error) throw error
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
  }
}
