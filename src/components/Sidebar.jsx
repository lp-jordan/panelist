import { useState, useEffect } from 'react'
import {
  listScripts,
  createScript,
  readScript,
  deleteScript,
} from '../utils/scriptRepository'

export default function Sidebar({ onSelectScript, onSelectFolder, renderAssets }) {
  const [collapsed, setCollapsed] = useState(false)
  const [scripts, setScripts] = useState([])
  const [newName, setNewName] = useState('')
  const [projectFolders, setProjectFolders] = useState([])

  async function refreshScripts() {
    const result = await listScripts()
    const list = result?.data ?? result
    const names = list.map((s) => s.name ?? s)
    setScripts(names)
  }

  useEffect(() => {
    refreshScripts()
    const folders = JSON.parse(localStorage.getItem('projectFolders') || '[]')
    setProjectFolders(folders)
  }, [])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    await createScript(name, {})
    setNewName('')
    refreshScripts()
  }

  async function handleSelect(name) {
    const result = await readScript(name)
    const data = result?.data ?? result
    onSelectScript?.(name, data)
  }

  async function handleDelete(name) {
    await deleteScript(name)
    refreshScripts()
  }

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
          <h3>Scripts</h3>
          <div className="new-script">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New script name"
            />
            <button onClick={handleCreate}>Add</button>
          </div>
          <ul>
            {scripts.length === 0 && <li>No scripts</li>}
            {scripts.map((s) => (
              <li key={s}>
                <span onClick={() => handleSelect(s)}>{s}</span>
                <button onClick={() => handleDelete(s)}>x</button>
              </li>
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

