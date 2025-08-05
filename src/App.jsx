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
  const [mode, setMode] = useState('Write')
  const [totalPages, setTotalPages] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const currentPage = { content: '' }
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
    content: currentPage.content,
  })

  function handleSelectProject(name, data) {
    setActiveProject(data)
  }

  function countWords(text) {
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0
  }

  function handleSelectPage(name, data) {
    setPageTitle(name)
    const content = data.content ?? ''
    editor?.commands?.setContent(content)
    const text = content.replace(/<[^>]+>/g, ' ')
    setWordCount(countWords(text))
  }

  function handlePagesChange(pages) {
    setTotalPages(pages.length)
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
      />
      <div className="version">Panelist v{__APP_VERSION__}</div>
    </div>
  )
}
