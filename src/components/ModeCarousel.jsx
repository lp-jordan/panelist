import { useState, useEffect } from 'react'

export default function ModeCarousel({ modes = ['Write', 'Preview'], onModeChange }) {
  const [index, setIndex] = useState(0)
  const currentMode = modes[index]

  useEffect(() => {
    onModeChange?.(currentMode)
  }, [currentMode, onModeChange])

  function prev() {
    setIndex((i) => (i - 1 + modes.length) % modes.length)
  }

  function next() {
    setIndex((i) => (i + 1) % modes.length)
  }

  return (
    <div className="mode-carousel">
      <button onClick={prev} disabled={modes.length <= 1}>
        {'<'}
      </button>
      <span className="mode-label">{currentMode}</span>
      <button onClick={next} disabled={modes.length <= 1}>
        {'>'}
      </button>
    </div>
  )
}
