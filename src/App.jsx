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
import ModeCarousel from './components/ModeCarousel'
import DevInfo from './components/DevInfo'
import SettingsSidebar from './components/SettingsSidebar'
import { updateScript, deleteScript } from './utils/scriptRepository'
import { Button } from './components/ui/button'

export default function App({ onSignOut }) {
  const [pageTitle, setPageTitle] = useState('Untitled Page')
  const [activeProject, setActiveProject] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [devLogs, setDevLogs] = useState([])
  const [mode, setMode] = useState('Write')
  const [pageContent, setPageContent] = useState('')
  const [totalPages, setTotalPages] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const sidebarRef = useRef(null)
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
    content: pageContent,
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor)
  }, [accentColor])

  function handleSelectProject(name, data) {
    setActiveProject(data)
  }

  function countWords(text) {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
  }

  function handleSelectPage(name, data) {
    const title = name || 'Untitled Page'
    setPageTitle(title)
    const content = data?.page_content ?? data?.content ?? ''
    setPageContent(content)
    if (editor) {
      editor.commands.setContent(content)
      setWordCount(countWords(editor.getText()))
    }
  }

  function handlePagesChange(pages) {
    setTotalPages(pages.length)
  }

  function logDev(message) {
    setDevLogs((logs) => [...logs.slice(-9), message])
  }

  useEffect(() => {
    if (!editor) return
    let timeoutId
    const saveHandler = () => {
      setIsSaving(true)
      logDev(`Save triggered for "${pageTitle}"`)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (activeProject) {
          logDev(
            `Saving "${pageTitle}" to project "${activeProject.name}"`,
          )
          try {
            const result = await updateScript(
              pageTitle,
              { page_content: editor.getJSON(), metadata: { version: 1 } },
              activeProject.id,
            )
            if (result === null) {
              logDev('Save returned null')
            } else {
              logDev('Save complete')
            }
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
  }, [editor, pageTitle, activeProject])

  useEffect(() => {
    if (!editor) return
    const countHandler = () => setWordCount(countWords(editor.getText()))
    editor.on('update', countHandler)
    countHandler()
    return () => {
      editor.off('update', countHandler)
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(pageContent)
    setWordCount(countWords(editor.getText()))
  }, [editor, pageContent])

  useEffect(() => {
    if (!editor) return
    editor.commands.setCharacterSuggestions(
      activeProject?.characters ?? [],
    )
  }, [editor, activeProject])

  async function handleDeleteCurrentPage() {
    if (!activeProject || !pageTitle) return
    if (!confirm(`Delete page "${pageTitle}"?`)) return
    try {
      await deleteScript(pageTitle, activeProject.id)
      const pages = await sidebarRef.current?.refreshPages()
      if (pages && pages.length > 0) {
        await sidebarRef.current?.selectPage(pages[0].name)
      } else {
        await sidebarRef.current?.selectPage('')
      }
    } catch (err) {
      console.error('Error deleting page:', err)
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        ref={sidebarRef}
        onSelectProject={handleSelectProject}
        onSelectPage={handleSelectPage}
        onSignOut={onSignOut}
        onPagesChange={handlePagesChange}
      />
      <div className="main-content">
        <ModeCarousel currentMode={mode} onModeChange={setMode} />
        <h1 className="page-title">
          {pageTitle}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeleteCurrentPage}
          >
            🗑️
          </Button>
        </h1>
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
        onClick={() => setSettingsOpen(true)}
      >
        ⚙️
      </Button>
      <SettingsSidebar
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
