import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'

const scriptsDir = join(cwd(), 'scripts')

async function ensureDir() {
  await mkdir(scriptsDir, { recursive: true })
}

export async function listScripts() {
  await ensureDir()
  const files = await readdir(scriptsDir)
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
}

export async function createScript(name, data) {
  await ensureDir()
  const filePath = join(scriptsDir, `${name}.json`)
  const payload = {
    metadata: {
      title: name,
      createdAt: new Date().toISOString(),
      ...data.metadata,
    },
    content: data.content ?? '',
  }
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

export async function readScript(name) {
  const filePath = join(scriptsDir, `${name}.json`)
  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content)
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
  const filePath = join(scriptsDir, `${name}.json`)
  await writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8')
  return updated
}

export async function deleteScript(name) {
  const filePath = join(scriptsDir, `${name}.json`)
  await unlink(filePath)
}
