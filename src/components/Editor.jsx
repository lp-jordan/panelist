import { useEffect } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { EditorContent } from '@tiptap/react'

export default function Editor({ editor, mode }) {
  useEffect(() => {
    if (mode) {
      console.log(`Editor mode set to: ${mode}`)
    }
  }, [mode])

  if (!editor) return null

  return (
    <>
      <BubbleMenu className="bubble-menu" editor={editor}>
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
  )
}
