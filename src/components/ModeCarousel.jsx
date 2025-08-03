import { useRef } from 'react'

const modes = ['Script', 'Tiles*', 'Animation*']

export default function ModeCarousel({ currentMode, onModeChange }) {
  const containerRef = useRef(null)

  function handleSelect(mode) {
    const isPlaceholder = mode.endsWith('*')
    const cleanMode = mode.replace('*', '')
    if (isPlaceholder) {
      console.log(`${cleanMode} mode is coming soon`)
      return
    }
    onModeChange?.(cleanMode)
  }

  return (
    <div className="mode-carousel" ref={containerRef}>
      {modes.map((mode) => {
        const cleanMode = mode.replace('*', '')
        const isActive = currentMode === cleanMode
        return (
          <button
            key={mode}
            className={isActive ? 'active' : ''}
            onClick={() => handleSelect(mode)}
          >
            {mode}
          </button>
        )
      })}
    </div>
  )
}
