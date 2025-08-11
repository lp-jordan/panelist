import { describe, it, expect } from 'vitest'
import { getText } from './serialization'

describe('getText', () => {
  it('returns empty string when text is missing', () => {
    const node = { content: [{}, { text: 'hi' }, { text: undefined }] }
    expect(getText(node)).toBe('hi')
  })

  it('recursively concatenates text from nested nodes', () => {
    const node = {
      content: [
        { content: [{ text: 'nested ' }] },
        { text: 'text' },
      ],
    }
    expect(getText(node)).toBe('nested text')
  })
})
