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
    createdAt: now,
    updatedAt: now,
    content: data.content ?? '',
  }
  const { error } = await supabase.from(TABLE).insert(payload)
  if (error) throw error
  return {
    metadata: {
      title: payload.title,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    },
    content: payload.content,
  }
}

export async function readScript(name) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('title, createdAt, updatedAt, content')
    .eq('title', name)
    .single()
  if (error) throw error
  return {
    metadata: {
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
      updatedAt: new Date().toISOString(),
    },
    content: data.content ?? existing.content,
  }
  const row = {
    title: updated.metadata.title,
    createdAt: updated.metadata.createdAt,
    updatedAt: updated.metadata.updatedAt,
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

