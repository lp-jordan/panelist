/* global __APP_VERSION__ */
import { useEditor } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'
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
import PageNavigator from './components/PageNavigator'
import { createPage } from './utils/pageRepository'
import { updateScript } from './utils/scriptRepository'

function ProjectHeader({ projectName, onAddPage, disabled }) {
  return (
    <div className="project-header">
      <span>{projectName ?? 'No project selected'}</span>
      <button
        className="add-page-btn"
        onClick={onAddPage}
        disabled={disabled}
      >
        +
      </button>
    </div>
  )
}

export default function App({ onSignOut }) {
  const [pageTitle, setPageTitle] = useState('Untitled Page')
  const [activeProject, setActiveProject] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState('Write')
  const sidebarRef = useRef(null)
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

  async function handleAddPage() {
    if (!activeProject) return
    const name = prompt('New page name:')?.trim()
    if (!name) return
    await createPage(name, {}, activeProject.id)
    await sidebarRef.current?.refreshPages(activeProject.id)
    await sidebarRef.current?.selectPage(name)
  }

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
        ref={sidebarRef}
        onSelectProject={handleSelectProject}
        onSelectPage={handleSelectPage}
        onSignOut={onSignOut}
      />
      <div className="editor-container">
        <ModeCarousel currentMode={mode} onModeChange={setMode} />
        <ProjectHeader
          projectName={activeProject?.name}
          onAddPage={handleAddPage}
          disabled={!activeProject}
        />
        <ModeCarousel onModeChange={setMode} />
        <PageNavigator
          projectId={activeProject?.id}
          onSelectPage={handleSelectPage}
        />
        <h1 className="editor-title">{pageTitle}</h1>
        {editor && <Editor editor={editor} mode={mode} />}
          {isSaving && <span className="saving-indicator"> saving...</span>}
        {editor && (
          <>
            <BubbleMenu
              className="bubble-menu"
              editor={editor}
            >
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'is-active' : ''}
              >
                B
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'is-active' : ''}
              >
                I
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={editor.isActive('underline') ? 'is-active' : ''}
              >
                U
              </button>
            </BubbleMenu>
            <EditorContent editor={editor} />
          </>
        )}
      </div>
      <div className="app-name">Panelist v{__APP_VERSION__}</div>
    </div>
  )
}
