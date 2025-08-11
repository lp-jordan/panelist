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
import Modal from './ui/modal'
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
  const [createOpen, setCreateOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [createError, setCreateError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState(null)

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

  function openCreateProject() {
    setNewProjectName('')
    setCreateError('')
    setCreateOpen(true)
  }

  async function submitCreateProject(e) {
    e?.preventDefault()
    const name = newProjectName.trim()
    if (!name) return
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setCreateError('Project already exists')
      return
    }
    try {
      if (!supabase) return
      await createProject(name, {})
      const list = await refreshProjects()
      setMenuOpen(false)
      const newProj = list.find((p) => p.name === name)
      if (newProj) await handleSelectProject(newProj)
      setCreateOpen(false)
    } catch (error) {
      if (error?.message?.includes('unique')) {
        setCreateError('Project already exists')
      }
      console.error('createProject failed:', error?.message || error)
      console.warn('Could not create project')
    }
  }

  function handleDeleteProject(e, project = selectedProject) {
    e?.stopPropagation()
    if (!project) return
    setProjectToDelete(project)
    setDeleteOpen(true)
  }

  async function confirmDeleteProject() {
    const project = projectToDelete
    if (!project) return
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
    } finally {
      setDeleteOpen(false)
      setProjectToDelete(null)
    }
  }

  // Expose an imperative handle if the parent wants to programmatically select a page index
  useImperativeHandle(
    ref,
    () => ({ selectPage: (idx, userInitiated = false) => onSelectPage?.(idx, userInitiated) }),
    [onSelectPage],
  )

  return (
    <>
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
                onClick={openCreateProject}
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
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={submitCreateProject}>
          <h2 className="section-heading">Create project</h2>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            autoFocus
            style={{ width: '100%', marginTop: '0.5rem' }}
          />
          {createError && <div className="modal-error">{createError}</div>}
          <div className="modal-actions">
            <Button type="submit">Create</Button>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <h2 className="section-heading">Delete project</h2>
        <p style={{ marginTop: '0.5rem' }}>
          Are you sure you want to delete "{projectToDelete?.name}"?
        </p>
        <div className="modal-actions">
          <Button onClick={confirmDeleteProject}>Delete</Button>
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </>
  )
})

export default Sidebar
