import { Node, mergeAttributes } from '@tiptap/core'

export const PageHeader = Node.create({
  name: 'pageHeader',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'h1' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['h1', mergeAttributes(HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setPageHeader:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})

export const PanelHeader = Node.create({
  name: 'panelHeader',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'h2' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['h2', mergeAttributes(HTMLAttributes, { class: 'panel-header' }), 0]
  },
  addCommands() {
    return {
      setPanelHeader:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})

function paragraphNode({ name, className }) {
  return Node.create({
    name,
    group: 'block',
    content: 'inline*',
    parseHTML() {
      return [{ tag: `p.${className}` }]
    },
    renderHTML({ HTMLAttributes }) {
      return ['p', mergeAttributes(HTMLAttributes, { class: className }), 0]
    },
    addCommands() {
      return {
        [
          `set${name.charAt(0).toUpperCase()}${name.slice(1)}`
        ]:
          () =>
          ({ commands }) =>
            commands.insertContent({ type: name }),
      }
    },
  })
}

export const Description = paragraphNode({
  name: 'description',
  className: 'description',
})

export const Dialogue = paragraphNode({
  name: 'dialogue',
  className: 'dialogue',
})

export const Sfx = paragraphNode({
  name: 'sfx',
  className: 'sfx',
})

export const NoCopy = paragraphNode({
  name: 'noCopy',
  className: 'no-copy',
})

export const CueLabel = paragraphNode({
  name: 'cueLabel',
  className: 'cue-label',
})

export const CueContent = paragraphNode({
  name: 'cueContent',
  className: 'cue-content',
})

export const Notes = paragraphNode({
  name: 'notes',
  className: 'notes',
})

