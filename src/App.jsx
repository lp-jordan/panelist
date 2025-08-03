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
  CueLabel,
  CueContent,
  Notes,
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
      CueLabel,
      CueContent,
      Notes,
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
    <div className="flex h-screen">
      <Sidebar
        onSelectProject={handleSelectProject}
        onSelectPage={handleSelectPage}
        onSignOut={onSignOut}
      />
      <div className="flex-1 overflow-auto p-8">
        <ModeCarousel currentMode={mode} onModeChange={setMode} />
        <h1 className="mb-4 text-center text-2xl font-bold">{pageTitle}</h1>
        {editor && <Editor editor={editor} mode={mode} />}
        {isSaving && (
          <span className="text-xs text-zinc-400"> saving...</span>
        )}
      </div>
      <div className="fixed bottom-4 right-4 text-sm text-zinc-500">
        Panelist v{__APP_VERSION__}
      </div>
    </div>
  )
}
