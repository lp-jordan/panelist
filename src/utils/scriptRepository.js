import { supabase } from './supabaseClient'

const TABLE = 'scripts'

export async function listScripts() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('name')
    .order('name')
  if (error) throw error
  return data
    ? data.map((row) => row.name)
    : []
}

export async function createScript(name, data) {
  const payload = {
    name,
    metadata: {
      title: name,
      createdAt: new Date().toISOString(),
      ...data.metadata,
    },
    content: data.content ?? '',
  }
  const { error } = await supabase.from(TABLE).insert(payload)
  if (error) throw error
  return payload
}

export async function readScript(name) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('metadata, content')
    .eq('name', name)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteScript(name) {
  const { error } = await supabase.from(TABLE).delete().eq('name', name)
  if (error) throw error
}
