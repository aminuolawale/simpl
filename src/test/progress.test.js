import { describe, it, expect } from 'vitest'
import { calcProgress } from '../lib/progress'

describe('calcProgress', () => {
  it('returns zero percentage for empty sessions', () => {
    expect(calcProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 })
  })
  it('calculates correct percentage', () => {
    const sessions = [
      { completed: true },
      { completed: true },
      { completed: false },
      { completed: false },
    ]
    expect(calcProgress(sessions)).toEqual({ completed: 2, total: 4, percentage: 50 })
  })
  it('rounds percentage to nearest integer', () => {
    const sessions = [{ completed: true }, { completed: false }, { completed: false }]
    expect(calcProgress(sessions).percentage).toBe(33)
  })
  it('returns 100 when all complete', () => {
    const sessions = [{ completed: true }, { completed: true }]
    expect(calcProgress(sessions)).toEqual({ completed: 2, total: 2, percentage: 100 })
  })
})
