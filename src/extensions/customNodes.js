import { Node, mergeAttributes } from '@tiptap/core'

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

