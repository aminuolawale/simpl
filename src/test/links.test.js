import { describe, it, expect } from 'vitest'
import {
  linkResource, linkResources, unlinkResource,
  setStudyCorpus, setSessionStudy, attachNote, setNoteResource,
} from '../lib/links'

// Minimal fake of the supabase-js query builder used by links.js.
function fakeSupabase({ count = 1, error = null } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      return {
        upsert: async (rows, opts) => { calls.push(['upsert', table, rows, opts]); return { error } },
        update: (values) => ({
          eq: async (col, val) => { calls.push(['update', table, values, col, val]); return { error, count } },
        }),
        delete: () => {
          const filters = []
          const q = {
            eq(col, val) { filters.push([col, val]); return q },
            then(resolve) { calls.push(['delete', table, filters]); resolve({ error }) },
          }
          return q
        },
      }
    },
  }
  return client
}

describe('resource ⇄ corpus links', () => {
  it('links one resource, ignoring an existing link', async () => {
    const sb = fakeSupabase()
    await linkResource(sb, 'c1', 'r1')
    expect(sb.calls).toEqual([
      ['upsert', 'corpus_resources', { corpus_id: 'c1', resource_id: 'r1' }, { ignoreDuplicates: true }],
    ])
  })

  it('links several resources in one call', async () => {
    const sb = fakeSupabase()
    await linkResources(sb, 'c1', ['r1', 'r2'])
    expect(sb.calls[0][2]).toEqual([
      { corpus_id: 'c1', resource_id: 'r1' },
      { corpus_id: 'c1', resource_id: 'r2' },
    ])
  })

  it('skips the request when there is nothing to link', async () => {
    const sb = fakeSupabase()
    await linkResources(sb, 'c1', [])
    expect(sb.calls).toEqual([])
  })

  it('unlinks only the given corpus/resource pair', async () => {
    const sb = fakeSupabase()
    await unlinkResource(sb, 'c1', 'r1')
    expect(sb.calls).toEqual([['delete', 'corpus_resources', [['corpus_id', 'c1'], ['resource_id', 'r1']]]])
  })
})

describe('single-parent links', () => {
  it('moves a study into a corpus and back out', async () => {
    const sb = fakeSupabase()
    await setStudyCorpus(sb, 's1', 'c1')
    await setStudyCorpus(sb, 's1', null)
    expect(sb.calls).toEqual([
      ['update', 'studies', { corpus_id: 'c1' }, 'id', 's1'],
      ['update', 'studies', { corpus_id: null }, 'id', 's1'],
    ])
  })

  it('attaches and detaches a session from a study', async () => {
    const sb = fakeSupabase()
    await setSessionStudy(sb, 'rs1', 'st1')
    await setSessionStudy(sb, 'rs1', undefined)
    expect(sb.calls.map(c => c[2])).toEqual([{ study_id: 'st1' }, { study_id: null }])
  })

  it('sets and clears a note resource', async () => {
    const sb = fakeSupabase()
    await setNoteResource(sb, 'n1', 'r1')
    await setNoteResource(sb, 'n1', null)
    expect(sb.calls.map(c => c[2])).toEqual([{ resource_id: 'r1' }, { resource_id: null }])
  })

  it('reports when the target row no longer exists', async () => {
    await expect(setStudyCorpus(fakeSupabase({ count: 0 }), 's1', 'c1')).rejects.toThrow(/Nothing was updated/)
  })
})

describe('attachNote', () => {
  it('attaches a note to a session', async () => {
    const sb = fakeSupabase()
    await attachNote(sb, 'n1', 'rs1')
    expect(sb.calls).toEqual([['update', 'notes', { reading_session_id: 'rs1' }, 'id', 'n1']])
  })

  it('explains the one-note-per-session rule on a unique violation', async () => {
    const sb = fakeSupabase({ error: Object.assign(new Error('duplicate key'), { code: '23505' }) })
    await expect(attachNote(sb, 'n1', 'rs1')).rejects.toThrow('That session already has a note.')
  })
})
