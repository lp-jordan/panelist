import { supabase } from './supabaseClient'

const TABLE = 'scripts'

export async function listScripts() {
  const { data, error } = await supabase.from(TABLE).select('title')
  if (error) throw error
  return (data ?? []).map((r) => r.title)
}

export async function createScript(name, data) {
  const now = new Date().toISOString()
  const payload = {
    title: name,
    created_at: now,
    updated_at: now,
    content: data.content ?? '',
  }
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
}

export async function readScript(name) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('title, created_at, updated_at, content')
    .eq('title', name)
    .single()
  if (error) throw error
  return {
    metadata: {
      title: data.title,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    content: data.content,
  }
}

export async function updateScript(name, data) {
  const existing = await readScript(name)
  const updated = {
    metadata: {
      ...existing.metadata,
      ...data.metadata,
      updated_at: new Date().toISOString(),
    },
    content: data.content ?? existing.content,
  }
  const row = {
    title: updated.metadata.title,
    created_at: updated.metadata.created_at,
    updated_at: updated.metadata.updated_at,
    content: updated.content,
  }
  const { error } = await supabase.from(TABLE).update(row).eq('title', name)
  if (error) throw error
  return updated
}

export async function deleteScript(name) {
  const { error } = await supabase.from(TABLE).delete().eq('title', name)
  if (error) throw error
}

