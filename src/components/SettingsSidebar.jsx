import { Button } from './ui/button'
import { cn } from '../lib/utils'
import { signOut } from '../utils/auth.js'
import { logger } from '../utils/logger.js'

export default function SettingsSidebar({
  open,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  onSignOut,
  showDevInfo,
  setShowDevInfo,
}) {
  async function handleSignOut() {
    const { error } = await signOut()
    if (error) {
      logger.error('signOut failed:', error)
    } else {
      onSignOut?.()
    }
  }

  return (
    <aside className={cn('settings-sidebar', open && 'open')}>
      <div className="settings-header">
        <div className="font-semibold">Settings</div>
      </div>
      <div>
        <h4 className="section-heading">Display</h4>
        <div className="setting-item">
          <label>
            Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
        <div className="setting-item">
          <label>
            Accent Color
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="settings-section">
        <h4 className="section-heading">Account</h4>
        <Button variant="ghost" className="full-width" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
      <div className="settings-section">
        <h4 className="section-heading">Developer</h4>
        <Button
          variant="ghost"
          className="full-width"
          onClick={() => setShowDevInfo(!showDevInfo)}
        >
          {showDevInfo ? 'Hide Dev Window' : 'Show Dev Window'}
        </Button>
      </div>
    </aside>
  )
}
