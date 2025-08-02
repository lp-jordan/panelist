import { getSupabase } from './supabaseClient'

const TABLE = 'scripts'

function handleUnauthorized(error) {
  if (error?.status === 401 || error?.message?.includes('not logged in')) {
    window.location.reload()
    return true
  }
  return false
}

export async function listScripts() {
  try {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from(TABLE)
      .select('title')
      .order('title')
    if (error) throw error
    return data ? data.map((row) => row.title) : []
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return []
  }
}

export async function createScript(name, data) {
  try {
    const now = new Date().toISOString()
    const payload = {
      title: name,
      created_at: now,
      updated_at: now,
      content: data.content ?? '',
    }
    const supabase = await getSupabase()
    const { error } = await supabase.from(TABLE).insert(payload)
    if (error) throw error
    return {
      metadata: {
        title: payload.title,
        created_at: payload.created_at,
        updated_at: payload.updated_at,
      },
      content: payload.content,
    }
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

export async function readScript(name) {
  try {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from(TABLE)
      .select('title, project_id, created_at, updated_at, content')
      .eq('title', name)
      .single()
    if (error) throw error
    return {
      metadata: {
        title: data.title,
        projectId: data.project_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
      content: data.content,
    }
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

export async function updateScript(name, data, projectId) {
  try {
    const existing = await readScript(name)
    if (!existing) return null
    const updated = {
      metadata: {
        ...existing.metadata,
        ...data.metadata,
        projectId: projectId ?? existing.metadata.projectId,
        updated_at: new Date().toISOString(),
      },
      content: data.content ?? existing.content,
    }
    const row = {
      title: updated.metadata.title,
      project_id: updated.metadata.projectId,
      created_at: updated.metadata.created_at,
      updated_at: updated.metadata.updated_at,
      content: updated.content,
    }
    const supabase = await getSupabase()
    const { error } = await supabase.from(TABLE).update(row).eq('title', name)
    if (error) throw error
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
  }
}

export async function deleteScript(name) {
  try {
    const supabase = await getSupabase()
    const { error } = await supabase.from(TABLE).delete().eq('title', name)
    if (error) throw error
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
  }
}
