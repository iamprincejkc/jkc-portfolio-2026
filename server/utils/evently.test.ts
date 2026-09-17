import { describe, expect, it } from 'vitest'
import {
  EDIT_TOKEN,
  PHOTO_NAME,
  WORLD_ID,
  bearerToken,
  clientIp,
  hashToken,
  keys,
  newEditToken,
  newMeta,
  newWorldId,
  parseVersion,
  sizeProblem,
  tokenMatches,
  VERSION_HEADERS,
} from './evently'

describe('evently identifiers', () => {
  it('mints world ids and tokens in the shapes the routes accept', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(newWorldId()).toMatch(WORLD_ID)
      expect(newEditToken()).toMatch(EDIT_TOKEN)
    }
  })

  it('never repeats itself', () => {
    const ids = new Set(Array.from({ length: 500 }, newWorldId))
    expect(ids.size).toBe(500)
  })

  it('accepts a browser-chosen photo name only in the same safe alphabet', () => {
    expect(PHOTO_NAME.test('abcDEF0123-_xyzQ')).toBe(true)
    // Anything that could walk out of the world's own key space is refused.
    expect(PHOTO_NAME.test('../../worlds:meta')).toBe(false)
    expect(PHOTO_NAME.test('abc:def0123456789')).toBe(false)
    expect(PHOTO_NAME.test('short')).toBe(false)
  })
})

describe('edit tokens', () => {
  it('matches the token it was hashed from', () => {
    const token = newEditToken()
    expect(tokenMatches(token, hashToken(token))).toBe(true)
  })

  it('refuses a different token, a missing one, and a malformed one', () => {
    const hash = hashToken(newEditToken())
    expect(tokenMatches(newEditToken(), hash)).toBe(false)
    expect(tokenMatches(null, hash)).toBe(false)
    expect(tokenMatches('', hash)).toBe(false)
    expect(tokenMatches('not-a-token', hash)).toBe(false)
  })

  it('stores a hash, never the token itself', () => {
    const token = newEditToken()
    const meta = newMeta(hashToken(token))
    expect(JSON.stringify(meta)).not.toContain(token)
    expect(meta.version).toBe(0)
  })

  it('reads a bearer token and nothing looser', () => {
    expect(bearerToken('Bearer abc')).toBe('abc')
    expect(bearerToken('bearer   abc ')).toBe('abc')
    expect(bearerToken('Basic abc')).toBeNull()
    expect(bearerToken('Bearer')).toBeNull()
    expect(bearerToken(undefined)).toBeNull()
  })
})

describe('versions', () => {
  it('reads a plain non-negative integer', () => {
    expect(parseVersion('0')).toBe(0)
    expect(parseVersion(' 42 ')).toBe(42)
  })

  it('refuses anything else, so a write with no usable base version is never unconditional', () => {
    for (const bad of [undefined, null, '', '*', '"3"', 'W/"3"', '3, 4', '-1', '1.5', '1e3', '9999999999']) {
      expect(parseVersion(bad)).toBeNull()
    }
  })

  it('uses headers the CDN has no meaning for', () => {
    // Netlify's edge consumed If-Match before the function saw it. Any standard
    // conditional header here would reintroduce that.
    for (const name of Object.values(VERSION_HEADERS)) {
      expect(name.startsWith('x-evently-')).toBe(true)
      expect(['etag', 'if-match', 'if-none-match']).not.toContain(name)
    }
  })
})

describe('size checks', () => {
  it('refuses a declared length over the limit before reading anything', () => {
    expect(sizeProblem('2000', null, 1000)).toMatch(/Too large/)
  })

  it('refuses a real length over the limit even when the declared one lied', () => {
    expect(sizeProblem('10', 2000, 1000)).toMatch(/Too large/)
  })

  it('refuses an empty body and accepts one inside the limit', () => {
    expect(sizeProblem('0', 0, 1000)).toMatch(/empty/)
    expect(sizeProblem('500', 500, 1000)).toBeNull()
    expect(sizeProblem(undefined, 500, 1000)).toBeNull()
  })
})

describe('storage keys and client address', () => {
  it('keeps every photo under its own world', () => {
    expect(keys.photo('AAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBB').startsWith(`${keys.photos('AAAAAAAAAAAAAAAA')}:`)).toBe(true)
    expect(keys.meta('AAAAAAAAAAAAAAAA')).not.toBe(keys.doc('AAAAAAAAAAAAAAAA'))
  })

  it('prefers the address Netlify observed over a forwarded header', () => {
    expect(clientIp('1.1.1.1', '9.9.9.9')).toBe('1.1.1.1')
    expect(clientIp(undefined, '9.9.9.9, 8.8.8.8')).toBe('9.9.9.9')
    expect(clientIp(undefined, undefined)).toBe('unknown')
  })
})
