import { beforeEach, describe, expect, it } from 'vitest'
import { __clearAll, consume, resetKey } from './rate-limit'

describe('rate limiter', () => {
  beforeEach(() => __clearAll())

  it('allows up to the limit', () => {
    for (let i = 0; i < 3; i += 1) expect(consume('k', 3, 60).ok).toBe(true)
  })

  it('blocks past the limit and reports a retry delay', () => {
    for (let i = 0; i < 3; i += 1) consume('k', 3, 60)
    const result = consume('k', 3, 60)
    expect(result.ok).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('counts down remaining attempts', () => {
    expect(consume('k', 3, 60).remaining).toBe(2)
    expect(consume('k', 3, 60).remaining).toBe(1)
    expect(consume('k', 3, 60).remaining).toBe(0)
  })

  it('keeps keys independent', () => {
    // One IP exhausting its PIN attempts must not lock anyone else out.
    for (let i = 0; i < 3; i += 1) consume('a', 3, 60)
    expect(consume('a', 3, 60).ok).toBe(false)
    expect(consume('b', 3, 60).ok).toBe(true)
  })

  it('opens a fresh window once the old one expires', () => {
    const start = 1_000_000
    for (let i = 0; i < 3; i += 1) consume('k', 3, 60, start)
    expect(consume('k', 3, 60, start + 59_000).ok).toBe(false)
    expect(consume('k', 3, 60, start + 61_000).ok).toBe(true)
  })

  it('clears a key on reset', () => {
    // A correct PIN resets the window so one typo does not burn it.
    for (let i = 0; i < 3; i += 1) consume('k', 3, 60)
    resetKey('k')
    expect(consume('k', 3, 60).ok).toBe(true)
  })
})
