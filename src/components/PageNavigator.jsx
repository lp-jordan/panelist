import { useState, useEffect } from 'react'
import { listPages, readPage } from '../utils/pageRepository'

export default function PageNavigator({ projectId, onSelectPage }) {
  const [pages, setPages] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (!projectId) {
      setPages([])
      setCurrentIndex(0)
      return
    }
    listPages(projectId).then((names) => {
      setPages(names)
      setCurrentIndex(0)
    })
  }, [projectId])

  useEffect(() => {
    if (pages.length === 0) return
    const name = pages[currentIndex]
    readPage(name, projectId).then((result) => {
      const data = result?.data ?? result
      onSelectPage?.(name, data)
    })
  }, [currentIndex, pages, projectId, onSelectPage])

  function prev() {
    if (pages.length === 0) return
    setCurrentIndex((i) => (i - 1 + pages.length) % pages.length)
  }

  function next() {
    if (pages.length === 0) return
    setCurrentIndex((i) => (i + 1) % pages.length)
  }

  return (
    <div className="page-navigator">
      <button onClick={prev} disabled={pages.length <= 1}>
        Prev
      </button>
      <span className="page-name">{pages[currentIndex] ?? 'No pages'}</span>
      <button onClick={next} disabled={pages.length <= 1}>
        Next
      </button>
    </div>
  )
}
