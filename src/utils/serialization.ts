import type { JSONContent } from '@tiptap/core'
import type { ScriptPage, Panel, Cue } from '../types/samplePage'

type JSONContentChild = {
  text?: string
  content?: JSONContentChild[]
}

export function getText(node?: JSONContentChild): string {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (!node.content) return ''
  return node.content.map(getText).join('')
}

/**
 * Convert a Tiptap JSON document into a {@link ScriptPage}.
 */
export function toScriptPage(doc: JSONContent): ScriptPage {
  const pageHeader = doc.content?.find(n => n.type === 'pageHeader')
  const page = pageHeader?.attrs?.page ?? 1
  const panelCount = pageHeader?.attrs?.panel_count ?? 0

  const panels: (Panel & { pendingLabel?: string })[] = []
  let current: (Panel & { pendingLabel?: string }) | null = null

  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'panelHeader':
        if (current) panels.push(current)
        current = {
          panel_number: node.attrs?.panel_number ?? panels.length + 1,
          header: getText(node),
          cues: [],
        }
        break
      case 'description':
        if (current) {
          const desc = getText(node)
          current.header = current.header ? `${current.header}: ${desc}` : desc
        }
        break
      case 'cueLabel':
        if (current) current.pendingLabel = getText(node)
        break
      case 'dialogue':
      case 'sfx':
      case 'cueContent':
        if (current && current.pendingLabel) {
          const cue: Cue = {
            type: node.attrs?.type ?? current.pendingLabel.toUpperCase(),
            label: current.pendingLabel,
            content: getText(node),
          }
          current.cues.push(cue)
          delete current.pendingLabel
        }
        break
      case 'notes':
        if (current) current.notes = getText(node)
        break
      default:
        break
    }
  }
  if (current) panels.push(current)

  return {
    page,
    panel_count: panelCount || panels.length,
    panels: panels.map(({ pendingLabel, ...rest }) => rest),
  }
}

/**
 * Build a Tiptap JSON document from a {@link ScriptPage}.
 */
export function fromScriptPage(page: ScriptPage): JSONContent {
  const content: JSONContent[] = []
  content.push({
    type: 'pageHeader',
    attrs: { page: page.page, panel_count: page.panel_count },
    content: [],
  })

  for (const panel of page.panels) {
    const [headerText, ...descParts] = panel.header.split(':')
    content.push({
      type: 'panelHeader',
      attrs: { panel_number: panel.panel_number },
      content: [{ type: 'text', text: headerText.trim() }],
    })
    const desc = descParts.join(':').trim()
    if (desc) {
      content.push({
        type: 'description',
        content: [{ type: 'text', text: desc }],
      })
    }
    for (const cue of panel.cues) {
      content.push({
        type: 'cueLabel',
        attrs: { label: cue.label },
        content: [{ type: 'text', text: cue.label }],
      })
      let nodeType = 'cueContent'
      if (cue.type === 'SFX') nodeType = 'sfx'
      else if (cue.type === 'CHARACTER') nodeType = 'dialogue'
      content.push({
        type: nodeType,
        attrs: { type: cue.type },
        content: [{ type: 'text', text: cue.content }],
      })
    }
    if (panel.notes) {
      content.push({
        type: 'notes',
        content: [{ type: 'text', text: panel.notes }],
      })
    }
  }

  return { type: 'doc', content }
}
