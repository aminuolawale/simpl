import { describe, it, expect, vi } from 'vitest'
import { deleteCorpus, deleteResource, deleteStudy, deleteNote, plural } from '../lib/deletion'

// Minimal fake of the supabase-js query builder used by deletion.js.
function fakeSupabase({ rows = [], deleteCount = 1, deleteError = null, removeError = null } = {}) {
  const calls = []
  const remove = vi.fn(async (paths) => { calls.push(['remove', paths]); return { error: removeError } })
  const client = {
    calls,
    remove,
    from(table) {
      return {
        select() {
          const q = {
            eq(col, val) { calls.push(['select', table, col, val]); return q },
            single: async () => ({ data: rows[0] ?? null, error: null }),
            then: (resolve) => resolve({ data: rows, error: null }),
          }
          return q
        },
        delete() {
          return {
            eq: async (col, val) => {
              calls.push(['delete', table, col, val])
              return { error: deleteError, count: deleteError ? null : deleteCount }
            },
          }
        },
      }
    },
    storage: { from: () => ({ remove }) },
  }
  return client
}

describe('deleteCorpus', () => {
  it('deletes the corpus row, then removes its PDFs from storage', async () => {
    const sb = fakeSupabase({ rows: [{ storage_path: 'u/c/a.pdf' }, { storage_path: 'u/c/b.pdf' }] })
    await deleteCorpus(sb, 'c')
    const kinds = sb.calls.map(c => c[0])
    expect(kinds).toEqual(['select', 'delete', 'remove'])
    expect(sb.calls[1]).toEqual(['delete', 'corpora', 'id', 'c'])
    expect(sb.remove).toHaveBeenCalledWith(['u/c/a.pdf', 'u/c/b.pdf'])
  })

  it('skips storage when the corpus has no PDFs', async () => {
    const sb = fakeSupabase({ rows: [] })
    await deleteCorpus(sb, 'c')
    expect(sb.remove).not.toHaveBeenCalled()
  })

  it('does not touch storage if the row delete fails', async () => {
    const sb = fakeSupabase({ rows: [{ storage_path: 'x' }], deleteError: new Error('denied') })
    await expect(deleteCorpus(sb, 'c')).rejects.toThrow('denied')
    expect(sb.remove).not.toHaveBeenCalled()
  })

  it('still succeeds if storage cleanup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sb = fakeSupabase({ rows: [{ storage_path: 'x' }], removeError: new Error('nope') })
    await expect(deleteCorpus(sb, 'c')).resolves.toBeUndefined()
    warn.mockRestore()
  })
})

describe('deleteResource', () => {
  it('deletes the row and its file', async () => {
    const sb = fakeSupabase({ rows: [{ storage_path: 'u/c/a.pdf' }] })
    await deleteResource(sb, 'r')
    expect(sb.calls).toContainEqual(['delete', 'resources', 'id', 'r'])
    expect(sb.remove).toHaveBeenCalledWith(['u/c/a.pdf'])
  })
})

describe('row deletes', () => {
  it('reports when nothing was deleted', async () => {
    await expect(deleteStudy(fakeSupabase({ deleteCount: 0 }), 's')).rejects.toThrow(/Nothing was deleted/)
  })

  it('treats a missing note as already deleted', async () => {
    const sb = fakeSupabase({ deleteCount: 0 })
    await expect(deleteNote(sb, 'session-1')).resolves.toBeUndefined()
    expect(sb.calls).toContainEqual(['delete', 'notes', 'reading_session_id', 'session-1'])
  })
})

describe('plural', () => {
  it('handles singular, regular and irregular plurals', () => {
    expect(plural(1, 'PDF')).toBe('1 PDF')
    expect(plural(3, 'PDF')).toBe('3 PDFs')
    expect(plural(2, 'study', 'studies')).toBe('2 studies')
  })
})
