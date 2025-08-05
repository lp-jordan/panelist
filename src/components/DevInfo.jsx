import React from 'react'

export default function DevInfo({
  projectName,
  currentPage,
  totalPages,
  wordCount,
  logs = [],
}) {
  return (
    <div className="dev-info">
      <div>Project: {projectName || 'None'}</div>
      <div>Page: {currentPage || 'None'}</div>
      <div>Total Pages: {totalPages}</div>
      <div>Total Words: {wordCount}</div>
      {logs.length > 0 && (
        <div className="dev-log">
          {logs.map((log, i) => (
            <div key={i} className="dev-log-entry">
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
