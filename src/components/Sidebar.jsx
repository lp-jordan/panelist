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
            onClick={() => onSelectPage?.(idx, true)}
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
    supabase,
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

  const refreshProjects = React.useCallback(async () => {
    if (!supabase) return []
    try {
      const list = await listProjects()
      setProjects(list)
      return list
    } catch (error) {
      console.error('listProjects failed:', error?.message || error)
      console.warn('Could not load projects')
      setProjects([])
      return []
    }
  }, [supabase])

  const handleSelectProject = React.useCallback(
    async (project) => {
      try {
        if (!project) return
        setSelectedProjectName(project.name)
        if (!supabase) return
        const data = await readProject(project.id)
        setSelectedProject(data)
        onSelectProject?.(project.id, data)

        // Auto-select the first page in this project by index (if any)
        if (Array.isArray(pages) && pages.length > 0) {
          onSelectPage?.(0, true)
        }

        setDropdownOpen(false)
      } catch (error) {
        console.error('readProject failed:', error?.message || error)
        console.warn('Could not load project')
      }
    },
    [onSelectProject, onSelectPage, pages, supabase],
  )

  useEffect(() => {
    if (!supabase) return
    // Initial load: fetch and select first project if available
    refreshProjects()
      .then((list) => {
        if (list.length > 0) {
          return handleSelectProject(list[0])
        }
      })
      .catch((error) => {
        console.error('refreshProjects failed:', error?.message || error)
        console.warn('Could not load projects')
      })
  }, [supabase, refreshProjects, handleSelectProject])

  async function handleCreateProject() {
    const name = prompt('New project name')?.trim()
    if (!name) return
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('Project already exists')
      return
    }
    try {
      if (!supabase) return
      await createProject(name, {})
      const list = await refreshProjects()
      setMenuOpen(false)
      const newProj = list.find((p) => p.name === name)
      if (newProj) await handleSelectProject(newProj)
    } catch (error) {
      if (error?.message?.includes('unique')) {
        alert('Project already exists')
      }
      console.error('createProject failed:', error?.message || error)
      console.warn('Could not create project')
    }
  }

  async function handleDeleteProject(e, project = selectedProject) {
    e?.stopPropagation()
    if (!project) return
    if (!confirm(`Delete project "${project.name}"?`)) return
    try {
      if (!supabase) return
      await deleteProject(project.id)
      const list = await refreshProjects()
      if (selectedProject?.id === project.id) {
        if (list.length > 0) {
          await handleSelectProject(list[0])
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
  useImperativeHandle(
    ref,
    () => ({ selectPage: (idx, userInitiated = false) => onSelectPage?.(idx, userInitiated) }),
    [onSelectPage],
  )

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
                    key={p.id}
                    className="project-item"
                    onClick={() => handleSelectProject(p)}
                  >
                    <div className="font-medium">{p.name}</div>
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
