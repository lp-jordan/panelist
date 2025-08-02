import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import SlashCommand from './extensions/SlashCommand'
import {
  PageHeader,
  PanelHeader,
  Description,
  Dialogue,
  Sfx,
  NoCopy,
} from './extensions/customNodes'

export default function App() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      PageHeader,
      PanelHeader,
      Description,
      Dialogue,
      Sfx,
      NoCopy,
      SlashCommand,
    ],
    content: '',
  })

  return <EditorContent editor={editor} />
}
