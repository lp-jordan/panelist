import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { listProjects, createProject, readProject, deleteProject } from '../utils/projectRepository'
import { signOut } from '../utils/auth.js'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

function PageNavigator({ pages = [], activePage = 0, onSelectPage }) {
  return (
    <div className="page-navigator">
      <h4 className="section-heading">Pages</h4>
      <ul className="page-list">
        {pages.length === 0 && <li className="empty-message">No pages</li>}
        {pages.map((title, idx) => (
          <li
            key={idx}
            className={cn('page-item', idx === activePage && 'active')}
            onClick={() => onSelectPage?.(idx)}
          >
            <div className="page-item-header">
              <div className="font-medium">{title}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const Sidebar = forwardRef(function Sidebar(
  { pages = [], activePage = 0, onSelectPage, onSelectProject, onSignOut },
  ref,
) {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)

  async function refreshProjects() {
    try {
      const result = await listProjects()
      const list = result?.data ?? result
      const names = list.map(p => p.name ?? p)
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
      .then(names => {
        if (names.length > 0) {
          handleSelectProject(names[0]).catch(error => {
            console.error('handleSelectProject failed:', error.message)
            console.warn('Could not select project')
          })
        }
      })
      .catch(error => {
        console.error('refreshProjects failed:', error.message)
        console.warn('Could not load projects')
      })
  }, [handleSelectProject])

  async function handleCreateProject() {
    const name = prompt('New project name')?.trim()
    if (!name) return
    try {
      await createProject(name, {})
      await refreshProjects()
      handleSelectProject(name).catch(error => {
        console.error('handleSelectProject failed:', error.message)
        console.warn('Could not select project')
      })
    } catch (error) {
      console.error('createProject failed:', error.message)
      console.warn('Could not create project')
    }
  }

  async function handleDeleteProject(e, name) {
    e.stopPropagation()
    if (!confirm(`Delete project "${name}"?`)) return
    try {
      await deleteProject(name)
      const names = await refreshProjects()
      if (selectedProject?.name === name) {
        if (names.length > 0) {
          await handleSelectProject(names[0])
        } else {
          setSelectedProject(null)
          onSelectProject?.('', null)
        }
      }
    } catch (err) {
      console.error('Error deleting project:', err)
    }
  }

  const handleSelectProject = React.useCallback(async (name) => {
    try {
      const result = await readProject(name)
      const data = result?.data ?? result
      setSelectedProject(data)
      onSelectProject?.(name, data)
    } catch (error) {
      console.error('readProject failed:', error.message)
      console.warn('Could not load project')
    }
  }, [onSelectProject])

  async function handleSignOut() {
    try {
      await signOut()
      onSignOut?.()
    } catch (error) {
      console.error('signOut failed:', error.message)
      console.warn('Sign out failed')
    }
  }

  useImperativeHandle(ref, () => ({ selectPage: onSelectPage }))

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
        {projects.map(p => (
          <li key={p} className="project-item" onClick={() => handleSelectProject(p)}>
            <div className="project-item-header">
              <div className="font-medium">{p}</div>
              <Button size="sm" variant="ghost" onClick={e => handleDeleteProject(e, p)}>
                🗑️
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {selectedProject && (
        <PageNavigator
          pages={pages}
          activePage={activePage}
          onSelectPage={onSelectPage}
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
