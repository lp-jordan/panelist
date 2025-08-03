import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
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
import { signOut } from '../utils/auth.js'

function Sidebar({
  onSelectScript,
  onSelectProject,
  onSelectFolder,
  renderAssets,
  onSignOut,
  activeScript: activeScriptProp,
}, ref) {
  const [collapsed, setCollapsed] = useState(false)
  const [scripts, setScripts] = useState([])
  const [newScriptName, setNewScriptName] = useState('')
  const [scriptError, setScriptError] = useState('')
  const [projects, setProjects] = useState([])
  const [newProjectName, setNewProjectName] = useState('')
  const [projectError, setProjectError] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [activeScriptState, setActiveScriptState] = useState(
    activeScriptProp ?? null,
  )
  const activeScript = activeScriptProp ?? activeScriptState

  useEffect(() => {
    if (activeScriptProp !== undefined) {
      setActiveScriptState(activeScriptProp)
    }
  }, [activeScriptProp])

    async function refreshScripts(projectId) {
      if (!projectId) {
        setScripts([])
        return
      }
      const names = await listScripts(projectId)
      setScripts(names)
    }

  async function refreshProjects() {
    const result = await listProjects()
    const list = result?.data ?? result
    const names = list.map((p) => p.name ?? p)
    setProjects(names)
    return names
  }

  useEffect(() => {
    refreshProjects().then((names) => {
      if (names.length > 0) {
        handleSelectProject(names[0])
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreateScript() {
    const name = newScriptName.trim()
    if (!name || !selectedProject) return
    try {
      await createScript(name, {}, selectedProject.id)
      setNewScriptName('')
      setScriptError('')
      refreshScripts(selectedProject.id)
    } catch (err) {
      console.error('Error creating script:', err)
      setScriptError(err.message)
    }
  }

    async function handleSelectScript(name) {
      const result = await readScript(name, selectedProject?.id)
      const data = result?.data ?? result
      setActiveScriptState(name)
      onSelectScript?.(name, data)
    }

    async function handleDeleteScript(name) {
      await deleteScript(name, selectedProject?.id)
      refreshScripts(selectedProject?.id)
    }

  async function handleCreateProject() {
    const name = newProjectName.trim()
    if (!name) return
    try {
      await createProject(name, {})
      setNewProjectName('')
      setProjectError('')
      await refreshProjects()
      handleSelectProject(name)
    } catch (err) {
      console.error('Error creating project:', err)
      setProjectError(err.message)
    }
  }

  async function handleSelectProject(name) {
    const result = await readProject(name)
    const data = result?.data ?? result
    setSelectedProject(data)
    setActiveScriptState(null)
    const handler = onSelectProject ?? onSelectFolder
    handler?.(name, data)
    refreshScripts(data?.id)
  }

  async function handleDeleteProject(name) {
    await deleteProject(name)
    const names = await refreshProjects()
    if (selectedProject?.name === name) {
      if (names.length > 0) {
        handleSelectProject(names[0])
      } else {
        setSelectedProject(null)
        setScripts([])
      }
    }
  }

  async function handleSignOut() {
    await signOut()
    onSignOut?.()
  }

  useImperativeHandle(ref, () => ({
    refreshScripts,
    selectScript: handleSelectScript,
  }))

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
          <div className="project-select">
            <select
              value={selectedProject?.name ?? ''}
              onChange={(e) => handleSelectProject(e.target.value)}
            >
              <option value="" disabled>
                Select project
              </option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="new-project">
              <input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name"
              />
              <button onClick={handleCreateProject}>Add</button>
              {projectError && <p className="error">{projectError}</p>}
            </div>
            <button
              disabled={!selectedProject}
              onClick={() =>
                selectedProject && handleDeleteProject(selectedProject.name)
              }
            >
              Delete Project
            </button>
          </div>
          {selectedProject && <h3>{selectedProject.name}</h3>}
          {selectedProject && (
            <>
              <div className="new-script">
                <input
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  placeholder="New script name"
                />
                <button onClick={handleCreateScript}>Add</button>
                {scriptError && <p className="error">{scriptError}</p>}
              </div>
              <ul>
                {scripts.length === 0 && <li>No scripts</li>}
                {scripts.map((s) => (
                  <li
                    key={s}
                    className={s === activeScript ? 'active-script' : ''}
                  >
                    <span onClick={() => handleSelectScript(s)}>{s}</span>
                    <button onClick={() => handleDeleteScript(s)}>x</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {renderAssets?.()}
        <button onClick={handleSignOut}>Sign out</button>
      </div>
    </aside>
  )
}

export default forwardRef(Sidebar)

