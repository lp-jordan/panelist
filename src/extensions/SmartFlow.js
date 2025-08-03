import { Extension, InputRule } from '@tiptap/core'

const flowMap = {
  pageHeader: 'panelHeader',
  panelHeader: 'description',
  description: 'character',
  character: 'dialogue',
  dialogue: 'character',
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
        const currentType = $from.parent.type.name
        const nextType = flowMap[currentType]
        const nextPos = $from.after()
        const nextNode = this.editor.state.doc.nodeAt(nextPos)
        if (nextNode && !isBoundary(nextNode.type.name)) {
          this.editor.commands.focus(nextPos)
          return true
        }
        if (!nextType) return false
        this.editor.chain().focus().insertContent({ type: nextType }).run()
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
  addInputRules() {
    const panelRule = new InputRule({
      find: /Panel--$/,
      handler: ({ state, range, chain }) => {
        let count = 0
        state.doc.descendants(node => {
          if (node.type.name === 'panelHeader') count++
        })
        const number = count + 1
        chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'panelHeader',
              content: [{ type: 'text', text: `Panel ${number}` }],
            },
            { type: 'description' },
          ])
          .run()
      },
    })
    return [panelRule]
  },
})

export default SmartFlow
