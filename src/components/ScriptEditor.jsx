import { useEffect } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { EditorContent } from '@tiptap/react'
import { Button } from './ui/button'

export default function ScriptEditor({ editor, mode }) {
  useEffect(() => {
    if (mode) {
      console.log(`ScriptEditor mode set to: ${mode}`)
    }
  }, [mode])

  if (!editor) return null

  return (
    <>
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
    </>
  )
}
