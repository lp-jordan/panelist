import { Extension } from '@tiptap/core'

const flowMap = {
  pageHeader: 'panelHeader',
  panelHeader: 'description',
  description: 'dialogue',
  dialogue: 'dialogue',
  sfx: 'dialogue',
  noCopy: 'dialogue',
}

function isBoundary(name) {
  return name === 'pageHeader' || name === 'panelHeader'
}

const SmartFlow = Extension.create({
  name: 'smartFlow',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { $from } = this.editor.state.selection
        const currentType = $from.parent.type.name
        const nextType = flowMap[currentType]
        if (!nextType) return false
        this.editor.chain().focus().insertContent({ type: nextType }).run()
        return true
      },
      Tab: () => {
        const { $from } = this.editor.state.selection
        const nextPos = $from.after()
        const nextNode = this.editor.state.doc.nodeAt(nextPos)
        if (!nextNode || isBoundary(nextNode.type.name)) return false
        this.editor.commands.focus(nextPos)
        return true
      },
      'Shift-Tab': () => {
        const { $from } = this.editor.state.selection
        const prevPos = $from.before()
        const prevNode = this.editor.state.doc.nodeAt(prevPos)
        if (!prevNode || isBoundary(prevNode.type.name) && prevNode.type.name !== 'panelHeader') return false
        this.editor.commands.focus(prevPos)
        return true
      },
    }
  },
})

export default SmartFlow
