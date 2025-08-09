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
import { scanDocument, recalcNumbering } from './utils/documentScanner'
import SettingsSidebar from './components/SettingsSidebar'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'

export default function App({ onSignOut }) {
  const [activeProject, setActiveProject] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [devLogs, setDevLogs] = useState([])
  const [mode, setMode] = useState('Script')
  const [pages, setPages] = useState([])
  const [activePage, setActivePage] = useState(0)
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
      const contentNodes = []
      pagesData.forEach((p) => {
        const doc = p?.page_content ?? { type: 'doc', content: [] }
        const json = typeof doc === 'string' ? JSON.parse(doc) : doc
        if (json?.content) contentNodes.push(...json.content)
      })
      editor?.commands.setContent({ type: 'doc', content: contentNodes })
      const titles = names
      setPages(titles)
      setActivePage(0)
      setWordCount(countWords(editor?.getText() ?? ''))
    } catch (err) {
      console.error('Error loading project pages:', err)
    }
  }

  function splitDocument(doc) {
    const pages = []
    let current = { type: 'doc', content: [] }
    ;(doc.content || []).forEach((node) => {
      if (node.type === 'pageHeader' && current.content.length > 0) {
        pages.push(current)
        current = { type: 'doc', content: [] }
      }
      current.content.push(node)
    })
    if (current.content.length > 0) pages.push(current)
    return pages
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
      setIsSaving(true)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (activeProject) {
          try {
            const doc = editor.getJSON()
            const pageDocs = splitDocument(doc)
            const titles = []
            for (const pageDoc of pageDocs) {
              const title = extractTitle(pageDoc)
              titles.push(title)
              try {
                if (existingPagesRef.current.includes(title)) {
                  await updateScript(title, { page_content: pageDoc, metadata: { version: 1 } }, activeProject.id)
                } else {
                  await createScript(title, { page_content: pageDoc, metadata: { version: 1 } }, activeProject.id)
                }
              } catch (err) {
                console.error('Error saving page:', err)
                logDev(`Error saving page: ${err.message}`)
              }
            }
            existingPagesRef.current = titles
            logDev('Save complete')
          } catch (err) {
            console.error('Error saving document:', err)
            logDev(`Error saving document: ${err.message}`)
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
  }, [editor, activeProject])

  useEffect(() => {
    if (!editor) return
    const updateHandler = () => {
      recalcNumbering(editor)
      const doc = editor.state.doc
      const info = scanDocument(doc)
      const titles = info.map(p => {
        const node = doc.nodeAt(p.pagePos)
        return node?.textContent || `Page ${p.pageNumber}`
      })
      setPages(titles)
      const pos = editor.state.selection.from
      let idx = 0
      for (let i = 0; i < info.length; i++) {
        const next = info[i + 1]?.pagePos ?? Infinity
        if (pos >= info[i].pagePos && pos < next) {
          idx = i
          break
        }
      }
      setActivePage(idx)
      setWordCount(countWords(editor.getText()))
      if (
        editor.state.selection.from === doc.content.size &&
        doc.lastChild?.type.name !== 'pageHeader'
      ) {
        editor.chain().focus().insertContent({ type: 'pageHeader' }).run()
      }
    }
    editor.on('update', updateHandler)
    editor.on('selectionUpdate', updateHandler)
    updateHandler()
    return () => {
      editor.off('update', updateHandler)
      editor.off('selectionUpdate', updateHandler)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.commands.setCharacterSuggestions(
      activeProject?.characters ?? [],
    )
  }, [editor, activeProject])

  function handleNavigatePage(index) {
    if (!editor) return
    const info = scanDocument(editor.state.doc)
    const pos = info[index]?.pagePos
    if (typeof pos === 'number') {
      editor.chain().focus().setTextSelection(pos).run()
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        ref={sidebarRef}
        pages={pages}
        activePage={activePage}
        onSelectProject={handleSelectProject}
        onSelectPage={handleNavigatePage}
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
