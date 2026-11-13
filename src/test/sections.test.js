import { describe, it, expect } from 'vitest'
import { flattenOutline, sectionsAfter, sectionPage, isValidRange } from '../lib/sections'

const outline = [
  { title: 'Introduction', pageNumber: 1, items: [] },
  { title: 'Chapter 1', pageNumber: 10, items: [
    { title: 'Chapter 1.1', pageNumber: 12, items: [] },
    { title: 'Chapter 1.2', pageNumber: 18, items: [] },
  ]},
  { title: 'Chapter 2', pageNumber: 30, items: [] },
  { title: 'Conclusion', pageNumber: 45, items: [] },
]

describe('flattenOutline', () => {
  it('returns items in document order including nested', () => {
    const flat = flattenOutline(outline)
    expect(flat.map(s => s.title)).toEqual([
      'Introduction', 'Chapter 1', 'Chapter 1.1', 'Chapter 1.2', 'Chapter 2', 'Conclusion',
    ])
  })
  it('handles empty outline', () => {
    expect(flattenOutline([])).toEqual([])
  })
  it('handles null outline', () => {
    expect(flattenOutline(null)).toEqual([])
  })
})

describe('sectionsAfter', () => {
  it('returns sections that follow the given title', () => {
    const after = sectionsAfter(outline, 'Chapter 1')
    expect(after[0].title).toBe('Chapter 1.1')
    expect(after.map(s => s.title)).not.toContain('Introduction')
    expect(after.map(s => s.title)).not.toContain('Chapter 1')
  })
  it('returns full list when title not found', () => {
    expect(sectionsAfter(outline, 'nonexistent')).toHaveLength(6)
  })
})

describe('sectionPage', () => {
  it('returns page number for top-level section', () => {
    expect(sectionPage(outline, 'Chapter 2')).toBe(30)
  })
  it('finds nested sections', () => {
    expect(sectionPage(outline, 'Chapter 1.2')).toBe(18)
  })
  it('returns null for unknown title', () => {
    expect(sectionPage(outline, 'nonexistent')).toBeNull()
  })
})

describe('isValidRange', () => {
  it('is true when end comes after start', () => {
    expect(isValidRange(outline, 'Introduction', 'Chapter 2')).toBe(true)
  })
  it('is false when end comes before start', () => {
    expect(isValidRange(outline, 'Chapter 2', 'Introduction')).toBe(false)
  })
  it('is false when start equals end', () => {
    expect(isValidRange(outline, 'Chapter 1', 'Chapter 1')).toBe(false)
  })
  it('is false when start title not found', () => {
    expect(isValidRange(outline, 'Unknown', 'Chapter 2')).toBe(false)
  })
  it('is false when end title not found', () => {
    expect(isValidRange(outline, 'Introduction', 'Unknown')).toBe(false)
  })
})
