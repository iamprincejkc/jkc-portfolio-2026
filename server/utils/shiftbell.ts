import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Shiftbell sync: the owner's PC alarm and phone alarm tell each other "timed in", "snoozed" and "day off",
 * so confirming on one silences the other. Shiftbell itself lives in Personal/Shiftbell; this is only the relay.
 *
 * The server stores opaque, end-to-end encrypted events and cannot read them. Both devices derive the
 * channel id, the access token and the AES key from one pairing secret that never reaches this server
 * (HKDF-SHA256, see `Personal/Shiftbell/docs/sync.md`). The first device to write claims the channel with
 * its token; after that only the same token reads or writes it.
 *
 * Every event is its own key, so two devices writing at the same moment can never overwrite each other,
 * and the clients merge events in any order (they are idempotent), so nothing here needs a version check.
 */

export const SHIFTBELL_LIMITS = {
  /** base64url of nonce + ciphertext + tag. A real event is about 250. */
  dataChars: 2048,
  /** Events kept per channel. A busy week is about 30. */
  eventsKept: 500,
  /** Older events are dropped: the alarms only ever look back a day. */
  keepDays: 30,
  /** Events returned per read. */
  page: 200,
  /** Polling while ringing is one read every 3 s per device. */
  readsPerMinute: 120,
  writesPerMinute: 60,
} as const

/** 128 bits as lowercase hex, derived from the pairing secret. */
export const CHANNEL_ID = /^[0-9a-f]{32}$/
/** 256 bits as base64url without padding. */
export const ACCESS_TOKEN = /^[A-Za-z0-9_-]{43}$/
const DATA = /^[A-Za-z0-9_-]+$/
const EVENT_ID = /^\d{13}-[0-9a-f]{8}$/

export type ChannelMeta = { v: 1; tokenHash: string; createdAt: number }

export const shiftbellKeys = {
  meta: (channel: string) => `${channel}:meta`,
  eventPrefix: (channel: string) => `${channel}:e:`,
  event: (channel: string, id: string) => `${channel}:e:${id}`,
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time: how long a comparison takes must not say how close a guess was. */
export function accessTokenMatches(token: string | null | undefined, expectedHash: string): boolean {
  if (!token || !ACCESS_TOKEN.test(token)) return false
  const actual = Buffer.from(hashAccessToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Sorts by write time, then a random tail so two writes in the same millisecond keep both. */
export function newEventId(now = Date.now()): string {
  return `${String(now).padStart(13, '0')}-${randomBytes(4).toString('hex')}`
}

export function eventTime(id: string): number {
  return Number(id.slice(0, 13))
}

/** What is wrong with an uploaded event, or null. */
export function dataProblem(data: unknown): string | null {
  if (typeof data !== 'string' || data.length === 0) return 'The event is missing.'
  if (data.length > SHIFTBELL_LIMITS.dataChars) return 'The event is too big.'
  if (!DATA.test(data)) return 'The event is not base64url.'
  return null
}

/** Event ids under a channel's prefix, oldest first, keeping only well-formed ones. */
export function eventIds(keys: string[], channel: string): string[] {
  const prefix = shiftbellKeys.eventPrefix(channel)
  return keys
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .filter((id) => EVENT_ID.test(id))
    .sort()
}

/** The ids a read returns: written at or after `since` (ms), oldest first, at most one page. */
export function idsSince(ids: string[], since: number): string[] {
  return ids.filter((id) => eventTime(id) >= since).slice(0, SHIFTBELL_LIMITS.page)
}

/** The ids to delete: too old, or beyond the per-channel cap (oldest go first). */
export function idsToPrune(ids: string[], now = Date.now()): string[] {
  const cutoff = now - SHIFTBELL_LIMITS.keepDays * 86_400_000
  const old = ids.filter((id) => eventTime(id) < cutoff)
  const kept = ids.filter((id) => eventTime(id) >= cutoff)
  const over = Math.max(0, kept.length - SHIFTBELL_LIMITS.eventsKept)
  return [...old, ...kept.slice(0, over)]
}

/** `?since=` as a millisecond timestamp; anything absent or odd means "from the start". */
export function parseSince(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,13}$/.test(value)) return 0
  return Number(value)
}
