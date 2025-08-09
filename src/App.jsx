/* global __APP_VERSION__ */
import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import ScriptEditor from './components/ScriptEditor'
import DevInfo from './components/DevInfo'
import { listScripts, readScript, updateScript, createScript } from './utils/scriptRepository'
import SettingsSidebar from './components/SettingsSidebar'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'

const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056

export default function App({ onSignOut }) {
  const [activeProject, setActiveProject] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [devLogs, setDevLogs] = useState([])
  const [mode, setMode] = useState('Script')
  const [pages, setPages] = useState([])
  const [pageDocs, setPageDocs] = useState([])
  const [activePage, setActivePage] = useState(0)
  const activePageRef = useRef(0)
  const [wordCount, setWordCount] = useState(0)
  const sidebarRef = useRef(null)
  const existingPagesRef = useRef([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState('light')
  const [accentColor, setAccentColor] = useState('#2563eb')
  const [showDevInfo, setShowDevInfo] = useState(false)
  const pageRefs = useRef([])
  const saveTimeoutsRef = useRef({})
  const [zoom, setZoom] = useState(1)

  const pageTitle = pages[activePage] ?? ''
  const totalPages = pages.length

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    activePageRef.current = activePage
  }, [activePage])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor)
  }, [accentColor])

  useEffect(() => {
    function updateZoom() {
      const widthScale = (window.innerWidth - 32) / PAGE_WIDTH
      const heightScale = (window.innerHeight - 32) / PAGE_HEIGHT
      setZoom(Math.min(widthScale, heightScale))
    }
    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [])

  function handleZoomIn() {
    setZoom(z => z * 1.1)
  }

  function handleZoomOut() {
    setZoom(z => z / 1.1)
  }

  function handleSelectProject(name, data) {
    setActiveProject(data)
    if (data) {
      loadProjectPages(data.id).catch(err => {
        console.error('loadProjectPages failed:', err)
      })
    }
  }

  function countWords(text) {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
  }

  async function loadProjectPages(projectId) {
    try {
      const names = await listScripts(projectId)
      existingPagesRef.current = names
      const pagesData = await Promise.all(
        names.map(n => readScript(n, projectId).catch(() => ({ page_content: null })))
      )
      const docs = pagesData.map((p) => {
        const doc = p?.page_content ?? { type: 'doc', content: [{ type: 'pageHeader' }] }
        return typeof doc === 'string' ? JSON.parse(doc) : doc
      })
      setPages(names)
      setPageDocs(docs)
      activePageRef.current = 0
      setActivePage(0)
      setWordCount(0)
    } catch (err) {
      console.error('Error loading project pages:', err)
    }
  }


  function extractTitle(pageDoc) {
    const header = pageDoc.content?.[0]
    if (!header) return 'Untitled Page'
    const text = (header.content || [])
      .map((c) => c.text || '')
      .join('')
      .trim()
    return text || 'Untitled Page'
  }

  function logDev(message) {
    setDevLogs((logs) => [...logs.slice(-9), message])
  }

  function handlePageUpdate(index, doc, text) {
    const title = extractTitle(doc)
    setPages(prev => {
      const next = [...prev]
      next[index] = title
      return next
    })
    setPageDocs(prev => {
      const next = [...prev]
      next[index] = doc
      return next
    })
    if (index === activePageRef.current) {
      setWordCount(countWords(text))
    }
    setIsSaving(true)
    clearTimeout(saveTimeoutsRef.current[index])
    saveTimeoutsRef.current[index] = setTimeout(async () => {
      if (activeProject) {
        try {
          if (existingPagesRef.current.includes(title)) {
            await updateScript(title, { page_content: doc, metadata: { version: 1 } }, activeProject.id)
          } else {
            await createScript(title, { page_content: doc, metadata: { version: 1 } }, activeProject.id)
            existingPagesRef.current.push(title)
          }
          logDev('Save complete')
        } catch (err) {
          console.error('Error saving page:', err)
          logDev(`Error saving page: ${err.message}`)
        } finally {
          setIsSaving(false)
        }
      } else {
        logDev('No active project; save skipped')
        setIsSaving(false)
      }
    }, 500)
  }

  function handlePageInView(index, editor) {
    activePageRef.current = index
    setActivePage(index)
    setWordCount(countWords(editor.getText()))
  }

  function handleNavigatePage(index) {
    const el = pageRefs.current[index]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function handleCreatePage() {
    const newDoc = { type: 'doc', content: [{ type: 'pageHeader' }] }
    const newIndex = pages.length
    setPages(prev => [...prev, 'Untitled Page'])
    setPageDocs(prev => [...prev, newDoc])
    setTimeout(() => {
      const el = pageRefs.current[newIndex]
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  return (
    <div className="app-layout">
      <Sidebar
        ref={sidebarRef}
        pages={pages}
        activePage={activePage}
        onSelectProject={handleSelectProject}
        onSelectPage={handleNavigatePage}
        onCreatePage={handleCreatePage}
        onSignOut={onSignOut}
        currentMode={mode}
        onModeChange={setMode}
      />
      <div className={cn('main-content', settingsOpen && 'shifted')}>
        {pageDocs.map((doc, idx) => (
          <ScriptEditor
            key={idx}
            ref={el => (pageRefs.current[idx] = el)}
            content={doc}
            mode={mode}
            pageIndex={idx}
            onUpdate={handlePageUpdate}
            onInView={handlePageInView}
            characters={activeProject?.characters ?? []}
            zoom={zoom}
          />
        ))}
        {isSaving && <span className="save-indicator"> saving...</span>}
      </div>
      {showDevInfo && (
        <DevInfo
          projectName={activeProject?.name}
          currentPage={pageTitle}
          totalPages={totalPages}
          wordCount={wordCount}
          logs={devLogs}
        />
      )}
      <div className="zoom-controls">
        <Button size="sm" variant="ghost" onClick={handleZoomOut}>
          -
        </Button>
        <span>{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" onClick={handleZoomIn}>
          +
        </Button>
      </div>
      <div className="version">Panelist v{__APP_VERSION__}</div>
      <Button
        size="sm"
        variant="ghost"
        className="settings-button"
        onClick={() => setSettingsOpen((open) => !open)}
      >
        ⚙️
      </Button>
      <SettingsSidebar
        open={settingsOpen}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        onSignOut={onSignOut}
        showDevInfo={showDevInfo}
        setShowDevInfo={setShowDevInfo}
      />
    </div>
  )
}
