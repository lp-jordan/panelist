/* global __APP_VERSION__ */
import { useEditor } from '@tiptap/react'
import { useState, useEffect } from 'react'
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
import Editor from './components/Editor'
import ModeCarousel from './components/ModeCarousel'
import DevInfo from './components/DevInfo'
import { updateScript } from './utils/scriptRepository'

export default function App({ onSignOut }) {
  const [pageTitle, setPageTitle] = useState('Untitled Page')
  const [activeProject, setActiveProject] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [devLogs, setDevLogs] = useState([])
  const [mode, setMode] = useState('Write')
  const [pageContent, _setPageContent] = useState('')
  const [totalPages, setTotalPages] = useState(0)
  const [wordCount, setWordCount] = useState(0)
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

  function handleSelectProject(name, data) {
    setActiveProject(data)
  }

  function countWords(text) {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
  }

  function handleSelectPage(name, data) {
    setPageTitle(name)
    const pageContent = data.page_content ?? data.content ?? ''
    if (editor) {
      editor.commands.setContent(pageContent)
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
  }, [editor, pageContent])

  useEffect(() => {
    if (!editor) return
    editor.commands.setCharacterSuggestions(
      activeProject?.characters ?? [],
    )
  }, [editor, activeProject])

  return (
    <div className="app-layout">
      <Sidebar
        onSelectProject={handleSelectProject}
        onSelectPage={handleSelectPage}
        onSignOut={onSignOut}
        onPagesChange={handlePagesChange}
      />
      <div className="main-content">
        <ModeCarousel currentMode={mode} onModeChange={setMode} />
        <h1 className="page-title">{pageTitle}</h1>
        {editor && <Editor editor={editor} mode={mode} />}
        {isSaving && <span className="save-indicator"> saving...</span>}
      </div>
      <DevInfo
        projectName={activeProject?.name}
        currentPage={pageTitle}
        totalPages={totalPages}
        wordCount={wordCount}
        logs={devLogs}
      />
      <div className="version">Panelist v{__APP_VERSION__}</div>
    </div>
  )
}
