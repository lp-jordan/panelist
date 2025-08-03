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
  }, [projectId])

  useImperativeHandle(ref, () => ({ refresh }))

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold">Pages</h4>
      <ul className="space-y-1">
        {pages.length === 0 && (
          <li className="text-sm text-zinc-400">No pages</li>
        )}
        {pages.map((p) => (
          <li
            key={p.name}
            className={cn(
              'cursor-pointer rounded-md p-2 text-sm hover:bg-zinc-800',
              p.name === activePage && 'bg-zinc-800',
            )}
            onClick={() => onSelectPage(p.name)}
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-zinc-400">{p.preview}</div>
          </li>
        ))}
      </ul>
      <Button
        className="mt-2 w-full"
        onClick={() => console.log('New Page placeholder')}
      >
        + New Page
      </Button>
    </div>
  )
})

function Sidebar({ onSelectPage, onSelectProject, onSignOut }, ref) {
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
    pageNavigatorRef.current?.refresh(data?.id)
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
    <aside className="w-64 border-r border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">
          {selectedProject?.name ?? 'Select project'}
        </div>
        <Button size="sm" onClick={handleCreateProject}>
          +
        </Button>
      </div>
      <ul className="mt-2 space-y-1">
        {projects.map((p) => (
          <li
            key={p}
            className="cursor-pointer rounded-md p-2 text-sm hover:bg-zinc-800"
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
        />
      )}
      <div className="mt-4">
        <Button variant="ghost" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </aside>
  )
}

export default forwardRef(Sidebar)
