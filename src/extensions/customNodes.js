import { Node, mergeAttributes } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

export const PageHeader = Node.create({
  /**
   * Page header containing page level metadata.
   *
   * Required attributes:
   * - page: page number
   * - panel_count: total number of panels on the page
   */
  name: 'pageHeader',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      page: {
        default: 1,
        parseHTML: element =>
          parseInt(element.getAttribute('data-page') || '1', 10),
        renderHTML: attrs => ({ 'data-page': attrs.page }),
      },
      panel_count: {
        default: 0,
        parseHTML: element =>
          parseInt(element.getAttribute('data-panel_count') || '0', 10),
        renderHTML: attrs => ({ 'data-panel_count': attrs.panel_count }),
      },
    }
  },
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
  /**
   * Marks the beginning of a panel.
   *
   * Required attributes:
   * - panel_number: sequential index of the panel
   */
  name: 'panelHeader',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      panel_number: {
        default: 1,
        parseHTML: element =>
          parseInt(element.getAttribute('data-panel_number') || '1', 10),
        renderHTML: attrs => ({ 'data-panel_number': attrs.panel_number }),
      },
    }
  },
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

function paragraphNode({ name, className, attrs = {} }) {
  return Node.create({
    name,
    group: 'block',
    content: 'inline*',
    addAttributes() {
      return attrs
    },
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
  attrs: {
    /** Cue type for dialogue nodes */
    type: {
      default: 'CHARACTER',
      parseHTML: element => element.getAttribute('data-type') || 'CHARACTER',
      renderHTML: attrs => ({ 'data-type': attrs.type }),
    },
  },
})

export const Character = Node.create({
  name: 'character',
  group: 'block',
  content: 'inline*',
  addOptions() {
    return {
      suggestion: {
        char: '',
        startOfLine: true,
        allowSpaces: true,
        items: ({ query }) => {
          const list =
            this.editor?.storage?.character?.suggestions ?? []
          return list
            .filter(item =>
              item.toLowerCase().startsWith(query.toLowerCase()),
            )
            .slice(0, 5)
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(props)
            .run()
        },
        render: () => {
          let element

          const renderItems = props => {
            element.innerHTML = ''

            props.items.forEach((item, index) => {
              const div = document.createElement('div')
              div.className = 'slash-command-item'
              if (index === props.selected) {
                div.classList.add('is-selected')
              }
              div.textContent = item
              div.addEventListener('mousedown', event => {
                event.preventDefault()
                props.command(item)
              })
              element.append(div)
            })
          }

          return {
            onStart: props => {
              element = document.createElement('div')
              element.className = 'slash-command-menu'
              renderItems(props)

              const { top, left } = props.clientRect()
              element.style.top = `${top + window.scrollY}px`
              element.style.left = `${left + window.scrollX}px`
              document.body.appendChild(element)
            },
            onUpdate(props) {
              renderItems(props)
              const { top, left } = props.clientRect()
              element.style.top = `${top + window.scrollY}px`
              element.style.left = `${left + window.scrollX}px`
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                element.remove()
                return true
              }
              return false
            },
            onExit() {
              element.remove()
            },
          }
        },
      },
    }
  },
  addStorage() {
    return {
      suggestions: [],
    }
  },
  parseHTML() {
    return [{ tag: 'p.character' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      mergeAttributes(HTMLAttributes, { class: 'character' }),
      0,
    ]
  },
  addCommands() {
    return {
      setCharacter:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
      setCharacterSuggestions:
        suggestions =>
        ({ editor }) => {
          editor.storage.character.suggestions = suggestions
          return true
        },
    }
  },
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })]
  },
})

export const Sfx = paragraphNode({
  name: 'sfx',
  className: 'sfx',
  attrs: {
    /** Cue type for sound effects */
    type: {
      default: 'SFX',
      parseHTML: element => element.getAttribute('data-type') || 'SFX',
      renderHTML: attrs => ({ 'data-type': attrs.type }),
    },
  },
})

export const NoCopy = paragraphNode({
  name: 'noCopy',
  className: 'no-copy',
  attrs: {
    /** Cue type representing omitted copy */
    type: {
      default: 'NO_COPY',
      parseHTML: element => element.getAttribute('data-type') || 'NO_COPY',
      renderHTML: attrs => ({ 'data-type': attrs.type }),
    },
  },
})

export const CueLabel = paragraphNode({
  name: 'cueLabel',
  className: 'cue-label',
})

export const CueContent = paragraphNode({
  name: 'cueContent',
  className: 'cue-content',
  attrs: {
    /** Cue type for generic content such as captions */
    type: {
      default: 'CAPTION',
      parseHTML: element => element.getAttribute('data-type') || 'CAPTION',
      renderHTML: attrs => ({ 'data-type': attrs.type }),
    },
  },
})

export const Notes = paragraphNode({
  name: 'notes',
  className: 'notes',
})

