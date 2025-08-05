// Utility to scan a Tiptap document and ensure sequential numbering for
// pages and panels. Page headers receive increasing page numbers and a
// panel count. Panel headers reset numbering on each new page.

/**
 * Scan a ProseMirror document and collect page and panel positions.
 * @param {import('@tiptap/core').Editor['state']['doc']} doc
 * @returns {Array<{pagePos:number,pageNumber:number,panelCount:number,panelPositions:number[]}>}
 */
export function scanDocument(doc) {
  const pages = []
  let current = null
  let pageNumber = 0

  doc.descendants((node, pos) => {
    if (node.type.name === 'pageHeader') {
      pageNumber += 1
      current = { pagePos: pos, pageNumber, panelCount: 0, panelPositions: [] }
      pages.push(current)
    } else if (node.type.name === 'panelHeader' && current) {
      current.panelCount += 1
      current.panelPositions.push(pos)
    }
  })

  return pages
}

/**
 * Recalculate numbering for all page and panel headers in the ScriptEditor.
 * Should be called after insert/delete operations.
 * @param {import('@tiptap/core').Editor} editor
 */
export function recalcNumbering(editor) {
  const { doc, tr } = editor.state
  const pages = scanDocument(doc)

  pages.forEach(page => {
    const pageNode = tr.doc.nodeAt(page.pagePos)
    if (pageNode) {
      tr.setNodeMarkup(page.pagePos, undefined, {
        ...pageNode.attrs,
        page: page.pageNumber,
        panel_count: page.panelCount,
      })
    }
    page.panelPositions.forEach((pos, idx) => {
      const panelNode = tr.doc.nodeAt(pos)
      if (panelNode) {
        tr.setNodeMarkup(pos, undefined, {
          ...panelNode.attrs,
          panel_number: idx + 1,
        })
      }
    })
  })

  if (tr.docChanged) {
    editor.view.dispatch(tr)
  }
}

export default { scanDocument, recalcNumbering }
