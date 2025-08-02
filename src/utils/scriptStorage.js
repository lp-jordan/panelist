import { supabase } from './supabaseClient'

const BUCKET = 'scripts'

export async function listScripts() {
  const { data, error } = await supabase.storage.from(BUCKET).list()
  if (error) throw error
  return data
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => f.name.replace(/\.json$/, ''))
}

export async function createScript(name, data) {
  const payload = {
    metadata: {
      title: name,
      createdAt: new Date().toISOString(),
      ...data.metadata,
    },
    content: data.content ?? '',
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${name}.json`, JSON.stringify(payload, null, 2), {
      contentType: 'application/json',
    })
  if (error) throw error
  return payload
}

export async function readScript(name) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${name}.json`)
  if (error) throw error
  const text = await data.text()
  return JSON.parse(text)
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
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${name}.json`, JSON.stringify(updated, null, 2), {
      contentType: 'application/json',
      upsert: true,
    })
  if (error) throw error
  return updated
}

export async function deleteScript(name) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([`${name}.json`])
  if (error) throw error
}
