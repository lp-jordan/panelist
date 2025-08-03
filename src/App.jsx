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

export default function App({ onSignOut }) {
  const [scriptTitle] = useState('Untitled Script')
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

  return (
    <div className="app-layout">
      <Sidebar onSignOut={onSignOut} />
      <div className="editor-container">
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
