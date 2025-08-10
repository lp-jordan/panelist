import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'

// Custom extensions / nodes
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
} from '../extensions/customNodes'

// Consistent page size used elsewhere in the app
const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056

const ScriptEditor = forwardRef(function ScriptEditor(
  {
    content,
    mode,            // kept to preserve behavior / styling toggles
    pageIndex,
    onUpdate,
    onInView,
    characters = [],
    zoom = 1,
  },
  ref,
) {
  // Expose the container to parent via ref
  const containerRef = useRef(null)
  useImperativeHandle(ref, () => containerRef.current)

  // Keep the latest callbacks in refs so their identity can change
  // without forcing the editor to re-create.
  const onUpdateRef = useRef(onUpdate)
  const onInViewRef = useRef(onInView)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onInViewRef.current = onInView }, [onInView])

  // Memoize extensions so `useEditor` receives a stable config.
  const extensions = useMemo(() => ([
    StarterKit.configure({
      history: true,
    }),
    Underline,
    // Custom nodes in your schema
    PageHeader,
    PanelHeader,
    Description,
    Character,
    Dialogue,
    Sfx,
    NoCopy,
    CueLabel,
    CueContent,
    // Custom logic extensions
    SlashCommand,
    SmartFlow,
  ]), [])

  // Memoize editorProps to keep identity stable
  const editorProps = useMemo(() => ({
    attributes: {
      class: 'editor', // keep your styling hook
      spellcheck: 'false',
      'data-page-index': String(pageIndex),
    },
  }), [pageIndex])

  // IMPORTANT: do not put onUpdate / onInView directly into useEditor.
  // We attach listeners after mount to keep config stable.
  const editor = useEditor({
    extensions,
    editorProps,
    content,
    autofocus: false, // avoid forced focus jumps that can cause scroll bounce
  })

  // Register update handler as a side-effect (stable)
  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      // Pass JSON + editor instance up; parent throttles state work
      onUpdateRef.current?.(pageIndex, editor.getJSON(), editor)
    }
    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, pageIndex])

  // Optional: observe visibility for onInView without recreating editor
  useEffect(() => {
    if (!editor || !containerRef.current) return
    const el = containerRef.current
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            onInViewRef.current?.(pageIndex, editor)
            break
          }
        }
      },
      { root: null, rootMargin: '0px', threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [editor, pageIndex])

  // Apply character suggestions from project as a side-effect
  useEffect(() => {
    if (!editor) return
    // Only call if the command exists on your SlashCommand extension
    if (editor.commands.setCharacterSuggestions) {
      editor.commands.setCharacterSuggestions(characters)
    }
  }, [editor, characters])

  // Log mode changes if you need it; doesn’t touch editor config
  useEffect(() => {
    if (mode) {
      // console.log(`ScriptEditor mode set to: ${mode}`)
    }
  }, [mode])

  return (
    <div
      ref={containerRef}
      className="editor-wrapper"
      style={{
        width: `${PAGE_WIDTH * zoom}px`,
        height: `${PAGE_HEIGHT * zoom}px`,
        transformOrigin: 'top left',
        transform: `scale(${zoom})`,
      }}
    >
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          {/* Keep your existing buttons; example for underline */}
          <button
            className={`btn ${editor.isActive('underline') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            type="button"
          >
            U
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
})

export default ScriptEditor
