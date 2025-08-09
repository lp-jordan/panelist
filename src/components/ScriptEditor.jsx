import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import SlashCommand from '../extensions/SlashCommand'
import SmartFlow from '../extensions/SmartFlow'
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
} from '../extensions/customNodes'
import { Button } from './ui/button'
import { recalcNumbering } from '../utils/documentScanner'

const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056

const ScriptEditor = forwardRef(function ScriptEditor(
  {
    content,
    mode,
    pageIndex,
    onUpdate,
    onInView,
    characters = [],
    zoom = 1,
  },
  ref,
) {
  const containerRef = useRef(null)
  useImperativeHandle(ref, () => containerRef.current)

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
    content,
    onUpdate: ({ editor }) => {
      recalcNumbering(editor)
      onUpdate?.(pageIndex, editor.getJSON(), editor.getText())
    },
  })

  useEffect(() => {
    if (mode) {
      console.log(`ScriptEditor mode set to: ${mode}`)
    }
  }, [mode])

  useEffect(() => {
    if (editor) {
      editor.commands.setCharacterSuggestions(characters)
    }
  }, [editor, characters])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !onInView) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onInView(pageIndex, editor)
          }
        })
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onInView, pageIndex, editor])

  if (!editor) return null

  return (
    <div
      ref={containerRef}
      className="page-wrapper"
      style={{ width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}
    >
      <div
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        <BubbleMenu className="editor-bubble-menu" editor={editor}>
          <Button
            size="sm"
            variant={editor.isActive('bold') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </Button>
          <Button
            size="sm"
            variant={editor.isActive('italic') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </Button>
          <Button
            size="sm"
            variant={editor.isActive('underline') ? 'default' : 'ghost'}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            U
          </Button>
        </BubbleMenu>
        <EditorContent editor={editor} className="editor-content" />
      </div>
    </div>
  )
})

export default ScriptEditor

