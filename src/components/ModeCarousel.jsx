import { Button } from './ui/button'

const modes = ['Script', 'Storyboards', 'Inks', 'Colors', 'Final']

export default function ModeCarousel({ currentMode, onModeChange }) {
  const index = modes.indexOf(currentMode)
  const prev = modes[(index - 1 + modes.length) % modes.length]
  const next = modes[(index + 1) % modes.length]

  return (
    <div className="mode-carousel">
      {modes.map((mode) => {
        let position = 'hidden'
        if (mode === currentMode) position = 'active'
        else if (mode === prev) position = 'prev'
        else if (mode === next) position = 'next'
        return (
          <Button
            key={mode}
            variant="ghost"
            className={`mode-button ${position}`}
            onClick={() => {
              if (mode === prev) onModeChange?.(prev)
              else if (mode === next) onModeChange?.(next)
            }}
          >
            {mode}
          </Button>
        )
      })}
    </div>
  )
}
