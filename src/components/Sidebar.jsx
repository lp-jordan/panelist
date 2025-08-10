import React, {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react'
import {
  listProjects,
  createProject,
  readProject,
  deleteProject,
} from '../utils/projectRepository'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import ModeCarousel from './ModeCarousel'

function PageNavigator({ pages = [], activePage = 0, onSelectPage, onCreatePage }) {
  return (
    <div className="page-navigator">
      <h4 className="section-heading">Pages</h4>
      <ul className="page-list">
        {pages.length === 0 && <li className="empty-message">No pages</li>}
        {pages.map((page, idx) => (
          <li
            key={page.id ?? idx}
            className={cn('page-item', idx === activePage && 'active')}
            onClick={() => onSelectPage?.(idx)}
          >
            <div className="page-item-header">
              <div className="font-medium">{page.title}</div>
            </div>
          </li>
        ))}
      </ul>
      <Button className="new-page-button" onClick={onCreatePage}>
        New page
      </Button>
    </div>
  )
}

const Sidebar = forwardRef(function Sidebar(
  {
    pages = [],
    activePage = 0,
    onSelectPage,
    onCreatePage,
    onSelectProject,
    currentMode,
    onModeChange,
  },
  ref,
) {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const dropdownRef = useRef(null)

  useEffect(() => {
    if (dropdownOpen) {
      dropdownRef.current?.focus()
    }
  }, [dropdownOpen])

  async function refreshProjects() {
    try {
      const result = await listProjects()
      const list = result?.data ?? result
      const names = list.map((p) => p.name ?? p)
      setProjects(names)
      return names
    } catch (error) {
      console.error('listProjects failed:', error?.message || error)
      console.warn('Could not load projects')
      setProjects([])
      return []
    }
  }

  const handleSelectProject = React.useCallback(
    async (name) => {
      try {
        setSelectedProjectName(name)
        const result = await readProject(name)
        const data = result?.data ?? result
        setSelectedProject(data)
        onSelectProject?.(name, data)

        // Auto-select the first page in this project by index (if any)
        if (Array.isArray(pages) && pages.length > 0) {
          onSelectPage?.(0)
        }

        setDropdownOpen(false)
      } catch (error) {
        console.error('readProject failed:', error?.message || error)
        console.warn('Could not load project')
      }
    },
    [onSelectProject, onSelectPage, pages],
  )

  useEffect(() => {
    // Initial load: fetch and select first project if available
    refreshProjects()
      .then((names) => {
        if (names.length > 0) {
          return handleSelectProject(names[0])
        }
      })
      .catch((error) => {
        console.error('refreshProjects failed:', error?.message || error)
        console.warn('Could not load projects')
      })
  }, [handleSelectProject])

  async function handleCreateProject() {
    const name = prompt('New project name')?.trim()
    if (!name) return
    if (projects.some((p) => p.toLowerCase() === name.toLowerCase())) {
      alert('Project already exists')
      return
    }
    try {
      await createProject(name, {})
      await refreshProjects()
      setMenuOpen(false)
      await handleSelectProject(name)
    } catch (error) {
      if (error?.message?.includes('unique')) {
        alert('Project already exists')
      }
      console.error('createProject failed:', error?.message || error)
      console.warn('Could not create project')
    }
  }

  async function handleDeleteProject(e, name = selectedProjectName) {
    e?.stopPropagation()
    if (!name) return
    if (!confirm(`Delete project "${name}"?`)) return
    try {
      await deleteProject(name)
      const names = await refreshProjects()
      if (selectedProjectName === name) {
        if (names.length > 0) {
          await handleSelectProject(names[0])
        } else {
          setSelectedProject(null)
          setSelectedProjectName('')
          onSelectProject?.('', null)
        }
      }
      setMenuOpen(false)
    } catch (err) {
      console.error('Error deleting project:', err?.message || err)
    }
  }

  // Expose an imperative handle if the parent wants to programmatically select a page index
  useImperativeHandle(ref, () => ({ selectPage: onSelectPage }), [onSelectPage])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div
          style={{ position: 'relative' }}
          tabIndex={0}
          ref={dropdownRef}
          onBlur={() => setDropdownOpen(false)}
        >
          <div
            className="font-semibold"
            style={{ cursor: 'pointer' }}
            onClick={() => setDropdownOpen((o) => !o)}
          >
            {selectedProjectName || 'Select project'}
          </div>
          {dropdownOpen && (
            <div className="project-dropdown">
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
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <Button size="sm" variant="ghost" onClick={() => setMenuOpen((o) => !o)}>
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

      <PageNavigator
        pages={pages}
        activePage={activePage}
        onSelectPage={onSelectPage}
        onCreatePage={onCreatePage}
      />

      <ModeCarousel currentMode={currentMode} onModeChange={onModeChange} />
    </aside>
  )
})

export default Sidebar
