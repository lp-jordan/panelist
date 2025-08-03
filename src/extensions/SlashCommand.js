import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

const SlashCommand = Extension.create({
  name: 'slash-command',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: true,
        items: ({ query }) => {
          return [
            {
              title: 'Page Header',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setPageHeader().run()
              },
            },
            {
              title: 'Panel Header',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setPanelHeader().run()
              },
            },
            {
              title: 'Description',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setDescription().run()
              },
            },
            {
              title: 'Character',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setCharacter().run()
              },
            },
            {
              title: 'Dialogue',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setDialogue().run()
              },
            },
            {
              title: 'Cue Label',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setCueLabel().run()
              },
            },
            {
              title: 'Cue Content',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setCueContent()
                  .run()
              },
            },
            {
              title: 'SFX',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setSfx().run()
              },
            },
            {
              title: 'Notes',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setNotes().run()
              },
            },
            {
              title: 'No Copy',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setNoCopy().run()
              },
            },
          ].filter(item =>
            item.title.toLowerCase().startsWith(query.toLowerCase())
          )
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
              div.textContent = item.title
              div.addEventListener('mousedown', event => {
                event.preventDefault()
                item.command(props)
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
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })]
  },
})

export default SlashCommand

