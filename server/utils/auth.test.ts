import { describe, expect, it } from 'vitest'
import {
  createSessionToken,
  safeEqual,
  scopeSatisfies,
  verifySessionToken,
} from './auth'

const SECRET = 'test-secret-that-is-at-least-32-chars-long'

describe('session tokens', () => {
  it('round-trips each scope', () => {
    expect(verifySessionToken(createSessionToken('site', SECRET), SECRET)).toBe('site')
    expect(verifySessionToken(createSessionToken('admin', SECRET), SECRET)).toBe('admin')
  })

  it('rejects a token signed with a different secret', () => {
    const token = createSessionToken('site', SECRET)
    expect(verifySessionToken(token, `${SECRET}-other`)).toBeNull()
  })

  it('rejects a forged payload reusing a real signature', () => {
    // The attack this guards: mint a viewer token, swap the payload for one
    // claiming admin, keep the signature.
    const token = createSessionToken('site', SECRET)
    const [, signature] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ s: 'admin', e: Math.floor(Date.now() / 1000) + 60, n: '0' }),
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    expect(verifySessionToken(`${forged}.${signature}`, SECRET)).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = createSessionToken('site', SECRET, 60, Date.now())
    expect(verifySessionToken(token, SECRET, Date.now() + 61_000)).toBeNull()
  })

  it('accepts a token that has not expired yet', () => {
    const token = createSessionToken('site', SECRET, 60, Date.now())
    expect(verifySessionToken(token, SECRET, Date.now() + 59_000)).toBe('site')
  })

  it('gives admin sessions a shorter life than viewer sessions', () => {
    const now = Date.now()
    const site = createSessionToken('site', SECRET, undefined, now)
    const admin = createSessionToken('admin', SECRET, undefined, now)
    // 3h is past the 2h admin TTL but inside the 12h site TTL.
    const later = now + 3 * 60 * 60 * 1000
    expect(verifySessionToken(site, SECRET, later)).toBe('site')
    expect(verifySessionToken(admin, SECRET, later)).toBeNull()
  })

  it('issues a different token each time', () => {
    // The nonce exists so two sessions minted in the same second still differ.
    const a = createSessionToken('site', SECRET)
    const b = createSessionToken('site', SECRET)
    expect(a).not.toBe(b)
  })

  it.each([undefined, null, '', 'garbage', 'no-dot', 'a.b'])(
    'rejects malformed input: %s',
    (input) => {
      expect(verifySessionToken(input as string | undefined, SECRET)).toBeNull()
    },
  )

  it('does not throw when the signature length differs', () => {
    const [body] = createSessionToken('site', SECRET).split('.')
    expect(verifySessionToken(`${body}.short`, SECRET)).toBeNull()
  })
})

describe('safeEqual', () => {
  it('matches identical values', () => {
    expect(safeEqual('03052026', '03052026')).toBe(true)
  })

  it('rejects values differing by one character', () => {
    expect(safeEqual('03052026', '03052027')).toBe(false)
  })

  it('rejects different lengths without throwing', () => {
    // Hashing first is what stops timingSafeEqual from throwing on a
    // length mismatch, which would leak the PIN's length via a 500.
    expect(safeEqual('1', '1234567890')).toBe(false)
  })
})

describe('scopeSatisfies', () => {
  it('lets admin do anything a viewer can', () => {
    expect(scopeSatisfies('admin', 'site')).toBe(true)
    expect(scopeSatisfies('admin', 'admin')).toBe(true)
  })

  it('does not let a viewer reach admin', () => {
    expect(scopeSatisfies('site', 'admin')).toBe(false)
  })

  it('treats no session as no access', () => {
    expect(scopeSatisfies(null, 'site')).toBe(false)
    expect(scopeSatisfies(null, 'admin')).toBe(false)
  })
})
