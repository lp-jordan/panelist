import { supabase } from './supabaseClient'

const TABLE = 'projects'

export async function listProjects() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('name')
    .order('name')
  if (error) throw error
  return data ? data.map((row) => row.name) : []
}

export async function createProject(name, data = {}) {
  const now = new Date().toISOString()
  const payload = {
    name,
    created_at: now,
    updated_at: now,
    ...data,
  }
  const { data: inserted, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return inserted
}

export async function readProject(name) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('name', name)
    .single()
  if (error) throw error
  return data
}

export async function updateProject(name, data) {
  const existing = await readProject(name)
  const updated = {
    ...existing,
    ...data,
    updated_at: new Date().toISOString(),
  }
  const { data: result, error } = await supabase
    .from(TABLE)
    .update(updated)
    .eq('name', name)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function deleteProject(name) {
  const { error } = await supabase.from(TABLE).delete().eq('name', name)
  if (error) throw error
}

