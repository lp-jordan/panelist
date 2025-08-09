/* global __APP_VERSION__ */
import { useEditor } from '@tiptap/react'
import { useState, useEffect, useRef } from 'react'
import StarterKit from '@tiptap/starter-kit'
import SlashCommand from './extensions/SlashCommand'
import SmartFlow from './extensions/SmartFlow'
import {
  PageHeader,
  PanelHeader,
  Description,
  Character,
  Dialogue,
  Sfx,
  NoCopy,
  CueLabel,
  CueContent,
  Notes,
} from './extensions/customNodes'
import Sidebar from './components/Sidebar'
import ScriptEditor from './components/ScriptEditor'
import DevInfo from './components/DevInfo'
import { listScripts, readScript, updateScript, createScript } from './utils/scriptRepository'
import { recalcNumbering } from './utils/documentScanner'
import SettingsSidebar from './components/SettingsSidebar'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'

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
  const editor = useEditor({
    extensions: [
      StarterKit,
      PageHeader,
      PanelHeader,
      Description,
      Character,
      Dialogue,
      Sfx,
      NoCopy,
      CueLabel,
      CueContent,
      Notes,
      SmartFlow,
      SlashCommand,
    ],
    content: '',
  })

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
      const first = docs[0] ?? { type: 'doc', content: [{ type: 'pageHeader' }] }
      editor?.commands.setContent(first)
      setWordCount(countWords(editor?.getText() ?? ''))
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

  useEffect(() => {
    if (!editor) return
    let timeoutId
    const saveHandler = () => {
      recalcNumbering(editor)
      setWordCount(countWords(editor.getText()))
      setIsSaving(true)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (activeProject) {
          try {
            const doc = editor.getJSON()
            const title = extractTitle(doc)
            const idx = activePageRef.current
            setPages(prev => {
              const next = [...prev]
              next[idx] = title
              return next
            })
            setPageDocs(prev => {
              const next = [...prev]
              next[idx] = doc
              return next
            })
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
    editor.on('update', saveHandler)
    return () => {
      editor.off('update', saveHandler)
      clearTimeout(timeoutId)
      setIsSaving(false)
    }
  }, [editor, activeProject, activePage])

  // No additional update handler; saving effect handles state updates

  useEffect(() => {
    if (!editor) return
    editor.commands.setCharacterSuggestions(
      activeProject?.characters ?? [],
    )
  }, [editor, activeProject])

  function handleNavigatePage(index) {
    if (!editor) return
    const currentDoc = editor.getJSON()
    const nextDoc = pageDocs[index] ?? { type: 'doc', content: [{ type: 'pageHeader' }] }
    setPageDocs(prev => {
      const docs = [...prev]
      docs[activePageRef.current] = currentDoc
      return docs
    })
    activePageRef.current = index
    setActivePage(index)
    editor.commands.setContent(nextDoc)
    setWordCount(countWords(editor.getText()))
  }

  function handleCreatePage() {
    if (!editor) return
    const newDoc = { type: 'doc', content: [{ type: 'pageHeader' }] }
    const newIndex = pages.length
    setPages(prev => [...prev, 'Untitled Page'])
    setPageDocs(prev => [...prev, newDoc])
    activePageRef.current = newIndex
    setActivePage(newIndex)
    editor.commands.setContent(newDoc)
    setWordCount(countWords(editor.getText()))
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
        {editor && <ScriptEditor editor={editor} mode={mode} />}
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
