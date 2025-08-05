import React from 'react'

export default function DevInfo({ projectName, currentPage, totalPages, wordCount }) {
  return (
    <div className="dev-info">
      <div>Project: {projectName || 'None'}</div>
      <div>Page: {currentPage || 'None'}</div>
      <div>Total Pages: {totalPages}</div>
      <div>Total Words: {wordCount}</div>
    </div>
  )
}
