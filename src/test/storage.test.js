import { describe, it, expect } from 'vitest'
import { resourcePath } from '../lib/storage'

describe('resourcePath', () => {
  it('constructs path as userId/corpusId/filename', () => {
    expect(resourcePath('user-1', 'corpus-2', 'doc.pdf'))
      .toBe('user-1/corpus-2/doc.pdf')
  })
  it('preserves the original filename', () => {
    const path = resourcePath('u', 'c', 'my file (1).pdf')
    expect(path.endsWith('my file (1).pdf')).toBe(true)
  })
  it('keeps user and corpus segments isolated', () => {
    const path = resourcePath('abc', 'def', 'x.pdf')
    const parts = path.split('/')
    expect(parts[0]).toBe('abc')
    expect(parts[1]).toBe('def')
  })
})
