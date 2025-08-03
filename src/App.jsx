/* global __APP_VERSION__ */
import { useEditor, EditorContent } from '@tiptap/react'
import { useState } from 'react'
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
import { readScript } from './utils/scriptRepository'

export default function App({ onSignOut }) {
  const [currentScript, setCurrentScript] = useState({
    title: 'Untitled Script',
    content: '',
  })
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
    content: currentScript.content,
  })

  async function handleScriptChange(name) {
    const result = await readScript(name)
    const data = result?.data ?? result
    if (!data) return
    const script = { ...data.metadata, content: data.content }
    setCurrentScript(script)
    editor?.commands.setContent(script.content)
  }

  return (
    <div className="app-layout">
      <Sidebar onSignOut={onSignOut} onSelectScript={handleScriptChange} />
      <div className="editor-container">
        <h1 className="editor-title">{currentScript.title}</h1>
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
