import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export default function App() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  })

  return <EditorContent editor={editor} />
}

