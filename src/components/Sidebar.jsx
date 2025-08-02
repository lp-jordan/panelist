import { useState, useEffect } from 'react'

export default function Sidebar({ onSelectScript, onSelectFolder, renderAssets }) {
  const [collapsed, setCollapsed] = useState(false)
  const [recentScripts, setRecentScripts] = useState([])
  const [projectFolders, setProjectFolders] = useState([])

  useEffect(() => {
    const scripts = JSON.parse(localStorage.getItem('recentScripts') || '[]')
    const folders = JSON.parse(localStorage.getItem('projectFolders') || '[]')
    setRecentScripts(scripts)
    setProjectFolders(folders)
  }, [])

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <button
        className="collapse-toggle"
        onClick={() => setCollapsed((c) => !c)}
      >
        {collapsed ? '>' : '<'}
      </button>
      <div className="sidebar-content">
        <section>
          <h3>Recent Scripts</h3>
          <ul>
            {recentScripts.length === 0 && <li>No scripts</li>}
            {recentScripts.map((s) => (
              <li key={s} onClick={() => onSelectScript?.(s)}>{s}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Project Folders</h3>
          <ul>
            {projectFolders.length === 0 && <li>No folders</li>}
            {projectFolders.map((f) => (
              <li key={f} onClick={() => onSelectFolder?.(f)}>{f}</li>
            ))}
          </ul>
        </section>
        {renderAssets?.()}
      </div>
    </aside>
  )
}

