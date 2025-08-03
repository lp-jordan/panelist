import { useRef } from 'react'
import { Button } from './ui/button'

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
    <div
      className="mb-4 flex gap-2 overflow-x-auto"
      ref={containerRef}
    >
      {modes.map((mode) => {
        const cleanMode = mode.replace('*', '')
        const isActive = currentMode === cleanMode
        return (
          <Button
            key={mode}
            variant={isActive ? 'default' : 'ghost'}
            onClick={() => handleSelect(mode)}
            className="whitespace-nowrap"
          >
            {mode}
          </Button>
        )
      })}
    </div>
  )
}
