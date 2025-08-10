/* global __APP_VERSION__ */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ScriptEditor from './components/ScriptEditor'
import DevInfo from './components/DevInfo'
import SettingsSidebar from './components/SettingsSidebar'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'

import { listScripts, readScript, updateScript, createScript } from './utils/scriptRepository'
import { supabase } from './utils/supabaseClient'

const PAGE_WIDTH = 816
const PAGE_HEIGHT = 1056

// ---------- Utilities ----------
function throttle(fn, wait = 150) {
  let last = 0
  let timeout = null
  let lastArgs = null
  return function throttled(...args) {
    const now = Date.now()
    const remaining = wait - (now - last)
    lastArgs = args
    if (remaining <= 0) {
      last = now
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      fn(...lastArgs)
      lastArgs = null
    } else if (!timeout) {
      timeout = setTimeout(() => {
        last = Date.now()
        timeout = null
        fn(...(lastArgs || []))
        lastArgs = null
      }, remaining)
    }
  }
}

function simpleWordCount(text) {
  if (!text) return 0
  return (text.match(/\b[\w’']+\b/g) || []).length
}

// Extract the page title from the first node of the document (your existing logic)
function extractTitle(pageDoc) {
  const header = pageDoc?.content?.[0]
  if (!header) return null
  const text = (header.content || [])
    .map(c => c.text || '')
    .join('')
    .trim()
  return text || null
}

// ---------- App ----------
export default function App({ onSignOut }) {
  const [activeProject, setActiveProject] = useState(null)
  const [pages, setPages] = useState([])            // array of ProseMirror JSON docs
  const [pageMeta, setPageMeta] = useState([])      // parallel array of metadata ({ id, title, ... })
  const [currentPage, setCurrentPage] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [mode, setMode] = useState('script')
  const [zoom, setZoom] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [devLogs, setDevLogs] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState('system')
  const [accentColor, setAccentColor] = useState('violet')
  const [showDevInfo, setShowDevInfo] = useState(true)

  // Refs to avoid stale closures + unnecessary re-renders
  const pageRefs = useRef([])
  const pagesRef = useRef(pages)
  const activeProjectRef = useRef(activeProject)
  const activePageRef = useRef(currentPage)
  const lastTextRef = useRef('')

  useEffect(() => { pagesRef.current = pages }, [pages])
  useEffect(() => { activeProjectRef.current = activeProject }, [activeProject])
  useEffect(() => { activePageRef.current = currentPage }, [currentPage])

  function logDev(message) {
    setDevLogs((logs) => [...logs.slice(-9), message])
  }

  // ----- Data bootstrapping -----
  useEffect(() => {
    async function loadInitial() {
      // You may already have project loading elsewhere; keep as is.
      // Here we assume a default "local session" or an already set project.
      try {
        // Load scripts for the active project if present
        if (activeProjectRef.current?.id) {
          const scripts = await listScripts(activeProjectRef.current.id)
          // Read each script into page docs (you could lazy load; this is simple)
          const docs = []
          const meta = []
          for (const s of scripts) {
            try {
              const rec = await readScript(s.id)
              const doc = rec?.page_content || { type: 'doc', content: [{ type: 'pageHeader' }] }
              docs.push(doc)
              meta.push({ id: s.id, title: rec?.metadata?.title ?? s.title ?? null })
            } catch (e) {
              console.error('Error reading script', s.id, e)
            }
          }
          setPages(docs)
          setPageMeta(meta)
          setCurrentPage(0)
          const initialText = getDocText(docs[0])
          lastTextRef.current = initialText
          setWordCount(simpleWordCount(initialText))
        } else {
          // Fallback single page if no project yet
          const doc = { type: 'doc', content: [{ type: 'pageHeader' }] }
          setPages([doc])
          setPageMeta([{ id: null, title: 'Page 1' }])
          setCurrentPage(0)
          lastTextRef.current = ''
          setWordCount(0)
        }
      } catch (e) {
        console.error('loadInitial error', e)
      }
    }
    loadInitial()
  }, [])

  // Helper to get plain text from a ProseMirror JSON doc
  function getDocText(doc) {
    // Minimal traversal for text – TipTap editors provide editor.getText(),
    // but here we only have JSON. This is cheap and good enough for the DevInfo.
    let out = ''
    function walk(node) {
      if (!node) return
      if (node.text) out += node.text + ' '
      if (node.content) node.content.forEach(walk)
    }
    walk(doc)
    return out.trim()
  }

  // ----- Update Handlers -----
  const handlePageUpdate = useCallback((index, doc /*, editor */) => {
    // Update page doc in state (immutable update)
    setPages(prev => {
      if (!prev || !prev.length) return prev
      if (index < 0 || index >= prev.length) return prev
      if (prev[index] === doc) return prev // same object ref (unlikely), skip
      const next = prev.slice()
      next[index] = doc
      return next
    })

    // Update derived info with **minimal** state writes
    const text = getDocText(doc)
    const wc = simpleWordCount(text)
    setWordCount(wc)
    lastTextRef.current = text

    // Update title for the page if changed
    const extracted = extractTitle(doc)
    setPageMeta(prev => {
      const current = prev[index] || {}
      const finalTitle = extracted ?? current.title ?? `Page ${index + 1}`
      if (current.title === finalTitle) return prev
      const next = prev.slice()
      next[index] = { ...current, title: finalTitle }
      return next
    })

    // Debounced save to backend
    queueSave(index, doc)
  }, [])

  // Create ONE throttled wrapper; identity stays stable
  const throttledHandlePageUpdate = useMemo(
    () => throttle(handlePageUpdate, 150),
    [handlePageUpdate]
  )

  // If you need to know which page is currently in view (for UI state)
  const handlePageInView = useCallback((index /*, editor */) => {
    if (index !== activePageRef.current) {
      setCurrentPage(index)
    }
  }, [])

  // Optional throttle if your intersection events are spammy
  const throttledHandlePageInView = useMemo(
    () => throttle(handlePageInView, 150),
    [handlePageInView]
  )

  // ----- Saving -----
  const pendingSavesRef = useRef(new Map())  // index -> lastDoc
  const saveTimeoutRef = useRef(null)

  function queueSave(index, doc) {
    pendingSavesRef.current.set(index, doc)
    if (saveTimeoutRef.current) return
    saveTimeoutRef.current = setTimeout(flushSaves, 400)
  }

  async function flushSaves() {
    const entries = Array.from(pendingSavesRef.current.entries())
    pendingSavesRef.current.clear()
    saveTimeoutRef.current = null
    if (!entries.length) return

    setIsSaving(true)
    try {
      for (const [index, doc] of entries) {
        const meta = pageMeta[index] || {}
        const id = meta.id
        const title = meta.title ?? `Page ${index + 1}`
        if (activeProjectRef.current?.id) {
          if (id) {
            // Update existing
            await updateScript(id, { page_content: doc, metadata: { title, version: 1 } })
          } else {
            // Create new and patch local id
            const newId = await createScript(
              title,
              { page_content: doc, metadata: { title, version: 1 } },
              activeProjectRef.current.id
            )
            setPageMeta(prev => {
              const next = prev.slice()
              next[index] = { ...(next[index] || {}), id: newId, title }
              return next
            })
          }
        }
      }
    } catch (e) {
      console.error('Error saving pages:', e)
      logDev(`Save error: ${String(e)}`)
    } finally {
      setIsSaving(false)
    }
  }

  // ----- Create New Page -----
  const handleCreatePage = useCallback(async () => {
    const newDoc = { type: 'doc', content: [{ type: 'pageHeader' }] }
    const newIndex = pagesRef.current.length
    const title = `Page ${newIndex + 1}`

    // Update local state immediately
    setPages(prev => [...prev, newDoc])
    setPageMeta(prev => [...prev, { id: null, title }])
    setCurrentPage(newIndex)

    // Create remotely if project exists
    if (activeProjectRef.current?.id) {
      try {
        const newId = await createScript(
          title,
          { page_content: newDoc, metadata: { title, version: 1 } },
          activeProjectRef.current.id
        )
        setPageMeta(prev => {
          const next = prev.slice()
          next[newIndex] = { id: newId, title }
          return next
        })
      } catch (err) {
        console.error('Error creating page:', err)
        logDev('Error creating page')
      }
    }
  }, [])

  // ----- UI -----
  return (
    <div className={cn('app-root', theme === 'dark' ? 'dark' : '')}>
      <Sidebar
        project={activeProject}
        setProject={setActiveProject}
        pages={pageMeta}
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        onCreatePage={handleCreatePage}
        mode={mode}
        setMode={setMode}
        zoom={zoom}
        setZoom={setZoom}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="editor-scroller">
        <div
          className="page-stack"
          style={{
            // width controls wrapping; keep enough spacing for page gutter
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: `minmax(${PAGE_WIDTH}px, ${PAGE_WIDTH}px)`,
            gap: '24px',
            justifyContent: 'center',
          }}
        >
          {pages.map((doc, idx) => (
            <ScriptEditor
              key={pageMeta[idx]?.id ?? `page-${idx}`} // stable key prevents remounts
              ref={el => (pageRefs.current[idx] = el)}
              content={doc}
              mode={mode}
              pageIndex={idx}
              onUpdate={throttledHandlePageUpdate}
              onInView={throttledHandlePageInView}
              characters={activeProject?.characters ?? []}
              zoom={zoom}
            />
          ))}
          {isSaving && <span className="save-indicator"> saving...</span>}
        </div>
      </div>

      {showDevInfo && (
        <div className="dev-info-wrapper">
          <DevInfo
            projectName={activeProject?.name}
            currentPage={currentPage + 1}
            totalPages={pages.length}
            wordCount={wordCount}
            logs={devLogs}
          />
        </div>
      )}

      <SettingsSidebar
        open={settingsOpen}
        theme={theme}
        setTheme={setTheme}
        accentColor={accentColor}
        setAccentColor={setAccentColor}
        onSignOut={onSignOut}
        showDevInfo={showDevInfo}
        setShowDevInfo={setShowDevInfo}
      />
    </div>
  )
}
