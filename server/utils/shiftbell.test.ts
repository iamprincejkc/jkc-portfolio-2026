import { describe, expect, it } from 'vitest'
import {
  SHIFTBELL_LIMITS,
  accessTokenMatches,
  dataProblem,
  eventIds,
  eventTime,
  hashAccessToken,
  idsSince,
  idsToPrune,
  newEventId,
  parseSince,
  shiftbellKeys,
} from './shiftbell'

// Made-up values, never a real pairing secret: Netlify's secret scanner reads this file.
const CHANNEL = '0123456789abcdef0123456789abcdef'
const TOKEN = 'A'.repeat(43)
const DAY = 86_400_000

describe('shiftbell access token', () => {
  it('matches only the token that claimed the channel', () => {
    const hash = hashAccessToken(TOKEN)
    expect(accessTokenMatches(TOKEN, hash)).toBe(true)
    expect(accessTokenMatches('B'.repeat(43), hash)).toBe(false)
  })

  it('refuses malformed tokens before hashing', () => {
    const hash = hashAccessToken(TOKEN)
    expect(accessTokenMatches(undefined, hash)).toBe(false)
    expect(accessTokenMatches('A'.repeat(42), hash)).toBe(false)
    expect(accessTokenMatches(`${'A'.repeat(42)}=`, hash)).toBe(false)
  })
})

describe('shiftbell events', () => {
  it('sort by write time and keep two writes in the same millisecond apart', () => {
    const a = newEventId(1_761_900_000_000)
    const b = newEventId(1_761_900_000_000)
    expect(a).not.toBe(b)
    expect(eventTime(a)).toBe(1_761_900_000_000)
    expect(newEventId(999) < newEventId(1_000)).toBe(true)
  })

  it('accept small base64url data only', () => {
    expect(dataProblem('abc-_09')).toBeNull()
    expect(dataProblem('')).not.toBeNull()
    expect(dataProblem(42)).not.toBeNull()
    expect(dataProblem('abc=')).not.toBeNull()
    expect(dataProblem('a'.repeat(SHIFTBELL_LIMITS.dataChars + 1))).not.toBeNull()
  })

  it('list only well-formed ids under the channel, oldest first', () => {
    const keys = [
      shiftbellKeys.event(CHANNEL, '0000000000002-aaaaaaaa'),
      shiftbellKeys.event(CHANNEL, '0000000000001-bbbbbbbb'),
      shiftbellKeys.meta(CHANNEL),
      shiftbellKeys.event(CHANNEL, 'nonsense'),
      shiftbellKeys.event('f'.repeat(32), '0000000000003-cccccccc'),
    ]
    expect(eventIds(keys, CHANNEL)).toEqual(['0000000000001-bbbbbbbb', '0000000000002-aaaaaaaa'])
  })

  it('read from a time on, including that millisecond', () => {
    const ids = ['0000000000010-aaaaaaaa', '0000000000020-aaaaaaaa', '0000000000030-aaaaaaaa']
    expect(idsSince(ids, 20)).toEqual(ids.slice(1))
    expect(idsSince(ids, 0)).toEqual(ids)
  })

  it('treat an odd since as from the start', () => {
    expect(parseSince('1761900000000')).toBe(1_761_900_000_000)
    expect(parseSince(undefined)).toBe(0)
    expect(parseSince('-5')).toBe(0)
    expect(parseSince('12abc')).toBe(0)
  })

  it('prune old events and anything past the cap', () => {
    const now = 100 * DAY
    const old = newEventId(now - 31 * DAY)
    const fresh = Array.from({ length: SHIFTBELL_LIMITS.eventsKept + 2 }, (_, i) => newEventId(now - DAY + i)).sort()
    const pruned = idsToPrune([old, ...fresh], now)
    expect(pruned).toEqual([old, fresh[0], fresh[1]])
  })
})
