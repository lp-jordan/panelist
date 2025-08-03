import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import { listScripts, readScript } from '../utils/scriptRepository'
import {
  listProjects,
  createProject,
  readProject,
} from '../utils/projectRepository'
import { signOut } from '../utils/auth.js'

const PageNavigator = forwardRef(function PageNavigator(
  { projectId, activePage, onSelectPage },
  ref,
) {
  const [pages, setPages] = useState([])

  async function refresh(id = projectId) {
    if (!id) {
      setPages([])
      return
    }
    const names = await listScripts(id)
    const enriched = await Promise.all(
      names.map(async (name) => {
        const result = await readScript(name, id)
        const data = result?.data ?? result
        const content = data?.content ?? ''
        const preview = content.split('\n')[0] || ''
        return { name, preview }
      }),
    )
    setPages(enriched)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useImperativeHandle(ref, () => ({ refresh }))

  return (
    <div className="page-navigator">
      <h4 className="section-label">Pages</h4>
      <ul>
        {pages.length === 0 && <li>No pages</li>}
        {pages.map((p) => (
          <li
            key={p.name}
            className={p.name === activePage ? 'active-page' : ''}
            onClick={() => onSelectPage(p.name)}
          >
            <span className="page-icon">📄</span>
            <div>
              <div className="page-title">{p.name}</div>
              <div className="page-preview">{p.preview}</div>
            </div>
          </li>
        ))}
      </ul>
      <button
        className="add-page"
        onClick={() => console.log('New Page placeholder')}
      >
        + New Page
      </button>
    </div>
  )
})

function Sidebar({
  onSelectPage,
  onSelectProject,
  onSelectFolder,
  renderAssets,
  onSignOut,
  activePage: activePageProp,
}, ref) {
  const [collapsed, setCollapsed] = useState(false)
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [activePageState, setActivePageState] = useState(
    activePageProp ?? null,
  )
  const activePage = activePageProp ?? activePageState
  const [exportScope, setExportScope] = useState('current')
  const pageNavigatorRef = useRef(null)

  useEffect(() => {
    if (activePageProp !== undefined) {
      setActivePageState(activePageProp)
    }
  }, [activePageProp])

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

  async function handleSelectPage(name) {
    const result = await readScript(name, selectedProject?.id)
    const data = result?.data ?? result
    setActivePageState(name)
    onSelectPage?.(name, data)
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
    pageNavigatorRef.current?.refresh(data?.id)
    setProjectDropdownOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    onSignOut?.()
  }

  function handleExport(format) {
    console.log(`Export ${exportScope} as ${format}`)
  }

  async function handleAccount() {
    await handleSignOut()
    console.log('Sign in placeholder')
  }

  function handleSettings() {
    console.log('Settings placeholder')
  }

  useImperativeHandle(ref, () => ({
    refreshPages: () => pageNavigatorRef.current?.refresh(),
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
            <ul
              className={`project-dropdown${projectDropdownOpen ? ' open' : ''}`}
            >
              {projects.map((p) => (
                <li key={p} onClick={() => handleSelectProject(p)}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          {projectDropdownOpen && (
            <ul className="project-dropdown">
              {projects.map((p) => (
                <li key={p} onClick={() => handleSelectProject(p)}>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {selectedProject && (
            <PageNavigator
              ref={pageNavigatorRef}
              projectId={selectedProject.id}
              activePage={activePage}
              onSelectPage={handleSelectPage}
            />
          )}
        </section>
        {renderAssets?.()}
        <div className="additional-options">
          <h4>Additional Options</h4>
          <div className="export-section">
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value)}
            >
              <option value="current">Current Page</option>
              <option value="selected">Selected Pages</option>
              <option value="full">Full Document</option>
            </select>
            <div className="export-formats">
              <button onClick={() => handleExport('PDF')}>PDF</button>
              <button onClick={() => handleExport('Docx')}>Docx</button>
            </div>
          </div>
          <button onClick={handleAccount}>Account</button>
          <button onClick={handleSettings}>Settings</button>
        </div>
      </div>
    </aside>
  )
}

export default forwardRef(Sidebar)

