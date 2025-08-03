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
  Dialogue,
  Sfx,
  NoCopy,
} from './extensions/customNodes'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import ModeCarousel from './components/ModeCarousel'
import { updateScript } from './utils/scriptRepository'

export default function App({ onSignOut }) {
  const [pageTitle, setPageTitle] = useState('Untitled Page')
  const [activeProject, setActiveProject] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState('Write')
  const currentPage = { content: '' }
  const editor = useEditor({
    extensions: [
      StarterKit,
      PageHeader,
      PanelHeader,
      Description,
      Dialogue,
      Sfx,
      NoCopy,
      SmartFlow,
      SlashCommand,
    ],
    content: currentPage.content,
  })

  function handleSelectProject(name, data) {
    setActiveProject(data)
  }

  function handleSelectPage(name, data) {
    setPageTitle(name)
    editor?.commands?.setContent(data.content ?? '')
  }

  useEffect(() => {
    if (!editor) return
    let timeoutId
    const saveHandler = () => {
      setIsSaving(true)
      clearTimeout(timeoutId)
      timeoutId = setTimeout(async () => {
        if (activeProject) {
          await updateScript(
            pageTitle,
            { content: editor.getHTML() },
            activeProject.id,
          )
        }
        setIsSaving(false)
      }, 500)
    }
    editor.on('update', saveHandler)
    return () => {
      editor.off('update', saveHandler)
      clearTimeout(timeoutId)
    }
  }, [editor, pageTitle, activeProject])

  return (
    <div className="app-layout">
      <Sidebar
        onSelectProject={handleSelectProject}
        onSelectPage={handleSelectPage}
        onSignOut={onSignOut}
      />
      <div className="editor-container">
        <ModeCarousel currentMode={mode} onModeChange={setMode} />
        <h1 className="editor-title">{pageTitle}</h1>
        {editor && <Editor editor={editor} mode={mode} />}
        {isSaving && <span className="saving-indicator"> saving...</span>}
      </div>
      <div className="app-name">Panelist v{__APP_VERSION__}</div>
    </div>
  )
}
