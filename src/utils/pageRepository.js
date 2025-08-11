// utils/pageRepository.js
import { supabase } from './supabaseClient'
import { getCurrentUserId } from './authCache'
import { handleUnauthorized } from './session'

const TABLE = 'pages'

// Keep these to remain compatible with any previously-encoded titles
function encodeTitle(name) {
  return encodeURIComponent(name)
}
function decodeTitle(name) {
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

function getClient() {
  return supabase
}

// List pages for a project (returns [{ id, title }])
export async function listPages(projectId) {
  try {
    const supabase = getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return []
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, title')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      title: decodeTitle(row.title),
    }))
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return []
  }
}

// Create a page; returns new page id.
export async function createPage(name, data, projectId) {
  try {
    const supabase = getClient()
    const now = new Date().toISOString()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return null
    const payload = {
      title: encodeTitle(name),
      created_at: now,
      updated_at: now,
      page_content: data?.page_content ?? null,
      version: data?.metadata?.version ?? 1,
      user_id: userId,
      project_id: projectId ?? null,
    }
    const { data: inserted, error } = await supabase
      .from(TABLE)
      .insert(payload)
      .select('id')
      .single()

    if (error) throw error
    return inserted?.id ?? null
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

// Read a page by ID (scoped to project + user).
export async function readPage(id, projectId) {
  if (!id) throw new Error('id required')
  if (!projectId) throw new Error('projectId required')

  try {
    const supabase = getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return null
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, title, project_id, created_at, updated_at, page_content, version')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single()

    if (error) throw error

    return {
      metadata: {
        id: data.id,
        title: decodeTitle(data.title),
        projectId: data.project_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        version: data.version,
      },
      page_content: data.page_content,
    }
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

// Update a page by ID.
export async function updatePage(id, data, projectId) {
  if (!id) throw new Error('id required')
  if (!projectId) throw new Error('projectId required')

    try {
      const supabase = await getClient()
      const existing = await readPage(id, projectId)
    if (!existing) return null

    const updated = {
      metadata: {
        ...existing.metadata,
        ...(data?.metadata || {}),
        projectId,
        updated_at: new Date().toISOString(),
      },
      page_content: data?.page_content ?? existing.page_content,
    }

    const row = {
      title: encodeTitle(updated.metadata.title ?? existing.metadata.title),
      project_id: updated.metadata.projectId,
      created_at: updated.metadata.created_at,
      updated_at: updated.metadata.updated_at,
      page_content: updated.page_content,
      version: updated.metadata.version,
    }

    const userId = await getCurrentUserId(supabase)
    if (!userId) return null
    const { error } = await supabase
      .from(TABLE)
      .update(row)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('project_id', projectId)

    if (error) throw error
    return true
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return false
  }
}

// Delete a page by ID.
export async function deletePage(id, projectId) {
  if (!id) throw new Error('id required')
  if (!projectId) throw new Error('projectId required')

  try {
    const supabase = getClient()
    const userId = await getCurrentUserId(supabase)
    if (!userId) return false
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('project_id', projectId)

    if (error) throw error
    return true
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return false
  }
}

// Convenience: load only content + version by ID.
export async function loadPageContent(id, projectId) {
  const page = await readPage(id, projectId)
  if (!page) return null
  return { page_content: page.page_content, version: page.metadata.version }
}

// Convenience: update only content + version by ID.
export async function savePageContent(id, pageContent, version, projectId) {
  return updatePage(id, { page_content: pageContent, metadata: { version } }, projectId)
}
