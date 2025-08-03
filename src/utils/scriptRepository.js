import { listPages, readPage } from './pageRepository'

export async function listScripts(projectId) {
  return listPages(projectId)
}

export async function readScript(name, projectId) {
  return readPage(name, projectId)
}
