/* global __APP_VERSION__ */
import { useEditor, EditorContent } from '@tiptap/react'
import { useState, useRef } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
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
import { createScript } from './utils/scriptRepository'

function ProjectHeader({ projectName, onAddScript, disabled }) {
  return (
    <div className="project-header">
      <span>{projectName ?? 'No project selected'}</span>
      <button
        className="add-script-btn"
        onClick={onAddScript}
        disabled={disabled}
      >
        +
      </button>
    </div>
  )
}

export default function App({ onSignOut }) {
  const [scriptTitle, setScriptTitle] = useState('Untitled Script')
  const [activeProject, setActiveProject] = useState(null)
  const sidebarRef = useRef(null)
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
    content: '',
  })

  async function handleAddScript() {
    if (!activeProject) return
    const name = prompt('New script name:')?.trim()
    if (!name) return
    await createScript(name, {}, activeProject.id)
    await sidebarRef.current?.refreshScripts(activeProject.id)
    await sidebarRef.current?.selectScript(name)
  }

  function handleSelectProject(name, data) {
    setActiveProject(data)
  }

  function handleSelectScript(name, data) {
    setScriptTitle(name)
    editor?.commands?.setContent(data.content ?? '')
  }

  return (
    <div className="app-layout">
      <Sidebar
        ref={sidebarRef}
        onSelectProject={handleSelectProject}
        onSelectScript={handleSelectScript}
        onSignOut={onSignOut}
      />
      <div className="editor-container">
        <ProjectHeader
          projectName={activeProject?.name}
          onAddScript={handleAddScript}
          disabled={!activeProject}
        />
        <h1 className="editor-title">{scriptTitle}</h1>
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
