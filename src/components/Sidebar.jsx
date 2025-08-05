import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import { listScripts, readScript } from '../utils/scriptRepository'
import { listProjects, createProject, readProject } from '../utils/projectRepository'
import { signOut } from '../utils/auth.js'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

const PageNavigator = forwardRef(function PageNavigator(
  { projectId, activePage, onSelectPage, onPagesChange },
  ref,
) {
  const [pages, setPages] = useState([])

  async function refresh(id = projectId) {
    if (!id) {
      setPages([])
      onPagesChange?.([])
      return
    }
    const names = await listScripts(id)
    const enriched = await Promise.all(
      names.map(async (name) => {
        const result = await readScript(name, id)
        const data = result?.data ?? result
        const content = data?.page_content ?? data?.content ?? ''
        const preview =
          typeof content === 'string' ? content.split('\n')[0] || '' : ''
        return { name, preview }
      }),
    )
    setPages(enriched)
    onPagesChange?.(enriched)
    return enriched
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  useImperativeHandle(ref, () => ({ refresh }))

  return (
    <div className="page-navigator">
      <h4 className="section-heading">Pages</h4>
      <ul className="page-list">
        {pages.length === 0 && <li className="empty-message">No pages</li>}
        {pages.map((p) => (
          <li
            key={p.name}
            className={cn('page-item', p.name === activePage && 'active')}
            onClick={() => onSelectPage(p.name)}
          >
            <div className="font-medium">{p.name}</div>
            <div className="page-preview">{p.preview}</div>
          </li>
        ))}
      </ul>
      <Button
        className="new-page-button full-width"
        onClick={() => console.log('New Page placeholder')}
      >
        + New Page
      </Button>
    </div>
  )
})

const Sidebar = forwardRef(function Sidebar(
  { onSelectPage, onSelectProject, onSignOut, onPagesChange },
  ref,
) {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [activePage, setActivePage] = useState(null)
  const pageNavigatorRef = useRef(null)

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
  }, [])

  async function handleSelectPage(name) {
    const result = await readScript(name, selectedProject?.id)
    const data = result?.data ?? result
    setActivePage(name)
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
    setActivePage(null)
    onSelectProject?.(name, data)
    const pages = await pageNavigatorRef.current?.refresh(data?.id)
    if (pages && pages.length > 0) {
      handleSelectPage(pages[0].name)
    }
  }

  async function handleSignOut() {
    await signOut()
    onSignOut?.()
  }

  useImperativeHandle(ref, () => ({
    refreshPages: () => pageNavigatorRef.current?.refresh(),
    selectPage: handleSelectPage,
  }))

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="font-semibold">
          {selectedProject?.name ?? 'Select project'}
        </div>
        <Button size="sm" onClick={handleCreateProject}>
          +
        </Button>
      </div>
      <ul className="project-list">
        {projects.map((p) => (
          <li
            key={p}
            className="project-item"
            onClick={() => handleSelectProject(p)}
          >
            {p}
          </li>
        ))}
      </ul>
      {selectedProject && (
        <PageNavigator
          ref={pageNavigatorRef}
          projectId={selectedProject.id}
          activePage={activePage}
          onSelectPage={handleSelectPage}
          onPagesChange={onPagesChange}
        />
      )}
      <div className="signout-container">
        <Button variant="ghost" className="full-width" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </aside>
  )
})

export default Sidebar
