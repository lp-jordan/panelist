import {
  listPages,
  readPage,
  updatePage,
  loadPageContent,
  savePageContent,
  createPage,
  deletePage,
} from './pageRepository'

export async function listScripts(supabase, projectId) {
  return listPages(supabase, projectId)
}

export async function readScript(supabase, name, projectId) {
  return readPage(supabase, name, projectId)
}

export async function updateScript(supabase, name, data, projectId) {
  return updatePage(supabase, name, data, projectId)
}

export async function createScript(supabase, name, data, projectId) {
  return createPage(supabase, name, data, projectId)
}

export async function loadScriptContent(supabase, name, projectId) {
  return loadPageContent(supabase, name, projectId)
}

export async function saveScriptContent(
  supabase,
  name,
  pageContent,
  version,
  projectId,
) {
  return savePageContent(supabase, name, pageContent, version, projectId)
}

export async function deleteScript(supabase, name, projectId) {
  return deletePage(supabase, name, projectId)
}
