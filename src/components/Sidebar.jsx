import { useState, useEffect } from 'react'
import {
  listScripts,
  createScript,
  readScript,
  deleteScript,
} from '../utils/scriptRepository'
import {
  listProjects,
  createProject,
  readProject,
  deleteProject,
} from '../utils/projectRepository'
export default function Sidebar({ onSelectScript, onSelectProject, onSelectFolder, renderAssets }) {
  const [collapsed, setCollapsed] = useState(false)
  const [scripts, setScripts] = useState([])
  const [newScriptName, setNewScriptName] = useState('')
  const [projects, setProjects] = useState([])
  const [newProjectName, setNewProjectName] = useState('')

  async function refreshScripts() {
    const result = await listScripts()
    const list = result?.data ?? result
    const names = list.map((s) => s.name ?? s)
    setScripts(names)
  }

  async function refreshProjects() {
    const result = await listProjects()
    const list = result?.data ?? result
    const names = list.map((p) => p.name ?? p)
    setProjects(names)
  }

  useEffect(() => {
    refreshScripts()
    refreshProjects()
  }, [])

  async function handleCreateScript() {
    const name = newScriptName.trim()
    if (!name) return
    await createScript(name, {})
    setNewScriptName('')
    refreshScripts()
  }

  async function handleSelectScript(name) {
    const result = await readScript(name)
    const data = result?.data ?? result
    onSelectScript?.(name, data)
  }

  async function handleDeleteScript(name) {
    await deleteScript(name)
    refreshScripts()
  }

  async function handleCreateProject() {
    const name = newProjectName.trim()
    if (!name) return
    await createProject(name, {})
    setNewProjectName('')
    refreshProjects()
  }

  async function handleSelectProject(name) {
    const result = await readProject(name)
    const data = result?.data ?? result
    const handler = onSelectProject ?? onSelectFolder
    handler?.(name, data)
  }

  async function handleDeleteProject(name) {
    await deleteProject(name)
    refreshProjects()
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <button
        className="collapse-toggle"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? '>' : '<'}
      </button>
      <div className="sidebar-content">
        <section>
          <h3>Scripts</h3>
          <div className="new-script">
            <input
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
              placeholder="New script name"
            />
            <button onClick={handleCreateScript}>Add</button>
          </div>
          <ul>
            {scripts.length === 0 && <li>No scripts</li>}
            {scripts.map((s) => (
              <li key={s}>
                <span onClick={() => handleSelectScript(s)}>{s}</span>
                <button onClick={() => handleDeleteScript(s)}>x</button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Projects</h3>
          <div className="new-project">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New project name"
            />
            <button onClick={handleCreateProject}>Add</button>
          </div>
          <ul>
            {projects.length === 0 && <li>No projects</li>}
            {projects.map((p) => (
              <li key={p}>
                <span onClick={() => handleSelectProject(p)}>{p}</span>
                <button onClick={() => handleDeleteProject(p)}>x</button>
              </li>
            ))}
          </ul>
        </section>
        {renderAssets?.()}
      </div>
    </aside>
  )
}

