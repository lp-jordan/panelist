import { getSupabase } from './supabaseClient'

const TABLE = 'pages'

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

export async function listPages(projectId) {
  try {
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { data, error } = await supabase
      .from(TABLE)
      .select('title')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .order('title')
    if (error) throw error
    return data ? data.map((row) => row.title) : []
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return []
  }
}

export async function createPage(name, data, projectId) {
  try {
    const now = new Date().toISOString()
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const payload = {
      title: name,
      created_at: now,
      updated_at: now,
      page_content: data.page_content ?? null,
      version: data.metadata?.version ?? 1,
      user_id: userId,
      project_id: projectId ?? null,
    }
    const { error } = await supabase.from(TABLE).insert(payload)
    if (error) throw error
    return {
      metadata: {
        title: payload.title,
        projectId: payload.project_id,
        created_at: payload.created_at,
        updated_at: payload.updated_at,
        version: payload.version,
      },
      page_content: payload.page_content,
    }
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
    return null
  }
}

export async function readPage(name, projectId) {
  if (!name) throw new Error('title required')
  if (!projectId) throw new Error('projectId required')
  try {
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { data, error } = await supabase
      .from(TABLE)
      .select('title, project_id, created_at, updated_at, page_content, version')
      .eq('title', name)
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .single()
    if (error) throw error
    return {
      metadata: {
        title: data.title,
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

export async function updatePage(name, data, projectId) {
  if (!name) throw new Error('title required')
  if (!projectId) throw new Error('projectId required')
  try {
    const existing = await readPage(name, projectId)
    if (!existing) return null
    const updated = {
      metadata: {
        ...existing.metadata,
        ...data.metadata,
        projectId: projectId,
        updated_at: new Date().toISOString(),
      },
      page_content: data.page_content ?? existing.page_content,
    }
    const row = {
      title: updated.metadata.title,
      project_id: updated.metadata.projectId,
      created_at: updated.metadata.created_at,
      updated_at: updated.metadata.updated_at,
      page_content: updated.page_content,
      version: updated.metadata.version,
    }
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { error } = await supabase
      .from(TABLE)
      .update(row)
      .eq('title', name)
      .eq('user_id', userId)
      .eq('project_id', projectId)
    if (error) throw error
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
  }
}

export async function deletePage(name, projectId) {
  if (!name) throw new Error('title required')
  if (!projectId) throw new Error('projectId required')
  try {
    const supabase = await getSupabase()
    const userId = await getCurrentUserId(supabase)
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('title', name)
      .eq('user_id', userId)
      .eq('project_id', projectId)
    if (error) throw error
  } catch (error) {
    if (!handleUnauthorized(error)) throw error
  }
}

export async function loadPageContent(name, projectId) {
  const page = await readPage(name, projectId)
  if (!page) return null
  return { page_content: page.page_content, version: page.metadata.version }
}

export async function savePageContent(
  name,
  pageContent,
  version,
  projectId,
) {
  return updatePage(
    name,
    { page_content: pageContent, metadata: { version } },
    projectId,
  )
}
