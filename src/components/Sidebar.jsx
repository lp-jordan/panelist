import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  listPages,
  createPage,
  readPage,
  deletePage,
} from '../utils/pageRepository'
import {
  listProjects,
  createProject,
  readProject,
} from '../utils/projectRepository'
import { signOut } from '../utils/auth.js'

function Sidebar({
  onSelectPage,
  onSelectProject,
  onSelectFolder,
  renderAssets,
  onSignOut,
  activePage: activePageProp,
}, ref) {
  const [collapsed, setCollapsed] = useState(false)
  const [pages, setPages] = useState([])
  const [newPageName, setNewPageName] = useState('')
  const [pageError, setPageError] = useState('')
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [activePageState, setActivePageState] = useState(
    activePageProp ?? null,
  )
  const activePage = activePageProp ?? activePageState

  useEffect(() => {
    if (activePageProp !== undefined) {
      setActivePageState(activePageProp)
    }
  }, [activePageProp])

    async function refreshPages(projectId) {
      if (!projectId) {
        setPages([])
        return
      }
      const names = await listPages(projectId)
      setPages(names)
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

  async function handleCreatePage() {
    const name = newPageName.trim()
    if (!name || !selectedProject) return
    try {
      await createPage(name, {}, selectedProject.id)
      setNewPageName('')
      setPageError('')
      refreshPages(selectedProject.id)
    } catch (err) {
      console.error('Error creating page:', err)
      setPageError(err.message)
    }
  }

    async function handleSelectPage(name) {
      const result = await readPage(name, selectedProject?.id)
      const data = result?.data ?? result
      setActivePageState(name)
      onSelectPage?.(name, data)
    }

    async function handleDeletePage(name) {
      await deletePage(name, selectedProject?.id)
      refreshPages(selectedProject?.id)
    }

  async function handleCreateProject() {
    const name = prompt('New project name')?.trim()
    if (!name) return
    try {
      await createProject(name, {})
      await refreshProjects()
      handleSelectProject(name)
    } catch (err) {
      console.error('Error creating project:', err)
    }
  }

  async function handleSelectProject(name) {
    const result = await readProject(name)
    const data = result?.data ?? result
    setSelectedProject(data)
    setActivePageState(null)
    const handler = onSelectProject ?? onSelectFolder
    handler?.(name, data)
    refreshPages(data?.id)
    setProjectDropdownOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    onSignOut?.()
  }

  useImperativeHandle(ref, () => ({
    refreshPages,
    selectPage: handleSelectPage,
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
          <div className="project-header">
            <div
              className="project-title"
              onClick={() => setProjectDropdownOpen((o) => !o)}
            >
              {selectedProject?.name ?? 'Select project'}{' '}
              <span className="dropdown-indicator">
                {projectDropdownOpen ? '▲' : '▼'}
              </span>
            </div>
            <button className="add-project" onClick={handleCreateProject}>
              +
            </button>
            {projectDropdownOpen && (
              <ul className="project-dropdown">
                {projects.map((p) => (
                  <li key={p} onClick={() => handleSelectProject(p)}>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedProject && (
            <>
              <div className="new-page">
                <input
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="New page name"
                />
                <button onClick={handleCreatePage}>Add</button>
                {pageError && <p className="error">{pageError}</p>}
              </div>
              <ul>
                {pages.length === 0 && <li>No pages</li>}
                {pages.map((s) => (
                  <li
                    key={s}
                    className={s === activePage ? 'active-page' : ''}
                  >
                    <span onClick={() => handleSelectPage(s)}>{s}</span>
                    <button onClick={() => handleDeletePage(s)}>x</button>
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

