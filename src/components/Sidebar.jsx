import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react'
import {
  listScripts,
  readScript,
  createScript,
  deleteScript,
} from '../utils/scriptRepository'
import {
  listProjects,
  createProject,
  readProject,
  deleteProject,
} from '../utils/projectRepository'
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
    try {
      const names = await listScripts(id)
      const enriched = await Promise.all(
        names.map(async (name) => {
          try {
            const result = await readScript(name, id)
            const data = result?.data ?? result
            const content = data?.page_content ?? data?.content ?? ''
            const preview =
              typeof content === 'string' ? content.split('\n')[0] || '' : ''
            return { name, preview }
          } catch (err) {
            console.error('Error reading page:', err)
            return { name, preview: '' }
          }
        }),
      )
      setPages(enriched)
      onPagesChange?.(enriched)
      return enriched
    } catch (err) {
      console.error('Error listing pages:', err)
      setPages([])
      onPagesChange?.([])
      return []
    }
  }

  async function handleCreatePage() {
    const name = prompt('New page name')?.trim()
    if (!name) return
    try {
      await createScript(name, {}, projectId)
      await refresh()
      onSelectPage(name, projectId)
    } catch (error) {
      console.error('createScript failed:', error.message)
      console.warn('Could not create page')
    }
  }

  async function handleDeletePage(e, name) {
    e.stopPropagation()
    if (!confirm(`Delete page "${name}"?`)) return
    try {
      await deleteScript(name, projectId)
      const pages = await refresh()
      if (name === activePage) {
        if (pages && pages.length > 0) {
          onSelectPage(pages[0].name, projectId)
        } else {
          onSelectPage(null, projectId)
        }
      }
    } catch (err) {
      console.error('Error deleting page:', err)
    }
  }

  useEffect(() => {
    refresh().catch((error) => {
      console.error('refresh failed:', error.message)
      console.warn('Could not load pages')
    })
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
            onClick={() => onSelectPage(p.name, projectId)}
          >
            <div className="page-item-header">
              <div className="font-medium">{p.name}</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => handleDeletePage(e, p.name)}
              >
                🗑️
              </Button>
            </div>
            <div className="page-preview">{p.preview}</div>
          </li>
        ))}
      </ul>
      <Button
        className="new-page-button full-width"
        onClick={handleCreatePage}
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
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pageNavigatorRef = useRef(null)

  async function refreshProjects() {
    try {
      const result = await listProjects()
      const list = result?.data ?? result
      const names = list.map((p) => p.name ?? p)
      setProjects(names)
      return names
    } catch (error) {
      console.error('listProjects failed:', error.message)
      console.warn('Could not load projects')
      setProjects([])
      return []
    }
  }

  useEffect(() => {
    refreshProjects()
      .then((names) => {
        if (names.length > 0) {
          handleSelectProject(names[0]).catch((error) => {
            console.error('handleSelectProject failed:', error.message)
            console.warn('Could not select project')
          })
        }
      })
      .catch((error) => {
        console.error('refreshProjects failed:', error.message)
        console.warn('Could not load projects')
      })
  }, [])

  async function handleSelectPage(name, projectId = selectedProject?.id) {
    if (!name) {
      setActivePage(null)
      onSelectPage?.('', { page_content: '' })
      return
    }
    try {
      const result = await readScript(name, projectId)
      const data = result?.data ?? result
      setActivePage(name)
      onSelectPage?.(name, data)
    } catch (err) {
      console.error('Error reading page:', err)
    }
  }

  async function handleCreateProject() {
    const name = prompt('New project name')?.trim()
    if (!name) return
    try {
      await createProject(name, {})
      await refreshProjects()
      setMenuOpen(false)
      handleSelectProject(name).catch((error) => {
        console.error('handleSelectProject failed:', error.message)
        console.warn('Could not select project')
      })
    } catch (error) {
      console.error('createProject failed:', error.message)
      console.warn('Could not create project')
    }
  }

  async function handleDeleteProject(e, name = selectedProject?.name) {
    e?.stopPropagation()
    if (!name) return
    if (!confirm(`Delete project "${name}"?`)) return
    try {
      await deleteProject(name)
      const names = await refreshProjects()
      if (selectedProject?.name === name) {
        if (names.length > 0) {
          await handleSelectProject(names[0])
        } else {
          setSelectedProject(null)
          setActivePage(null)
          onSelectProject?.('', null)
          onSelectPage?.('', { page_content: '' })
        }
      }
      setMenuOpen(false)
    } catch (err) {
      console.error('Error deleting project:', err)
    }
  }

  async function handleSelectProject(name) {
    try {
      const result = await readProject(name)
      const data = result?.data ?? result
      setSelectedProject(data)
      setActivePage(null)
      onSelectProject?.(name, data)
      const pages = await pageNavigatorRef.current?.refresh(data?.id)
      if (pages && pages.length > 0) {
        await handleSelectPage(pages[0].name, data?.id)
      }
      setDropdownOpen(false)
    } catch (error) {
      console.error('readProject failed:', error.message)
      console.warn('Could not load project')
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
      onSignOut?.()
    } catch (error) {
      console.error('signOut failed:', error.message)
      console.warn('Sign out failed')
    }
  }

  useImperativeHandle(ref, () => ({
    refreshPages: () => pageNavigatorRef.current?.refresh(),
    selectPage: handleSelectPage,
  }))

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div
          className="font-semibold"
          style={{ cursor: 'pointer' }}
          onClick={() => setDropdownOpen((o) => !o)}
        >
          {selectedProject?.name ?? 'Select project'}
        </div>
        <div style={{ position: 'relative' }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋮
          </Button>
          {menuOpen && (
            <div className="project-menu">
              <Button
                variant="ghost"
                className="project-menu-item"
                onClick={handleCreateProject}
              >
                Create project
              </Button>
              {selectedProject && (
                <Button
                  variant="ghost"
                  className="project-menu-item"
                  onClick={(e) => handleDeleteProject(e)}
                >
                  Delete project
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {dropdownOpen && (
        <ul className="project-list">
          {projects.map((p) => (
            <li
              key={p}
              className="project-item"
              onClick={() => handleSelectProject(p)}
            >
              <div className="font-medium">{p}</div>
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
