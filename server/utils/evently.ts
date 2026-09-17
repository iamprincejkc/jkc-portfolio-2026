import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Evently shared worlds.
 *
 * Anyone can make a world in the browser and send it to someone as a link or a
 * QR code. The server stores those worlds, and it cannot read a single word of
 * them: the world and every photo are encrypted in the browser with a key that
 * lives only in the link's `#fragment`, which browsers never send to a server.
 * What arrives here is opaque bytes with a size.
 *
 * That shapes everything in this file:
 *
 * - There are no accounts. Whoever created a world holds an edit token, a
 *   256-bit secret handed back once at creation. Only its SHA-256 is stored, so
 *   a leaked store does not hand out edit rights either.
 * - The server cannot validate content it cannot read, so it validates the
 *   only things it can see: identifiers, sizes, counts and versions.
 * - Concurrent editors (a world can be shared for editing) are kept honest with
 *   a version number and `If-Match`, so a stale tab cannot silently overwrite
 *   someone else's letter.
 *
 * Everything here is pure and takes its inputs as arguments. The storage calls
 * live in the route handlers.
 */

export const EVENTLY_LIMITS = {
  /** The encrypted world document: text, settings, photo references. */
  docBytes: 512 * 1024,
  /**
   * One encrypted photo. The browser resizes to 1280px and aims under 450 KB
   * first; the headroom is for Safari, which cannot encode WebP and falls back
   * to JPEG.
   */
  photoBytes: 700 * 1024,
  /** Photos per world. Every one is a download on someone's phone. */
  photos: 12,
  /** New worlds per client per window. Creation is the only unauthenticated write. */
  createPerWindow: 20,
  createWindowSeconds: 60 * 60,
} as const

/** 12 random bytes, base64url: 16 characters, 96 bits. */
export const WORLD_ID = /^[A-Za-z0-9_-]{16}$/

/** Photo names are chosen by the browser, in the same shape as a world id. */
export const PHOTO_NAME = /^[A-Za-z0-9_-]{16}$/

/** 32 random bytes, base64url: 43 characters. */
export const EDIT_TOKEN = /^[A-Za-z0-9_-]{43}$/

export type WorldMeta = {
  /** Schema of this record, not of the encrypted document. */
  v: 1
  tokenHash: string
  /** 0 means reserved but never written, which reads as "not found". */
  version: number
  createdAt: string
  updatedAt: string
}

export function newWorldId(): string {
  return randomBytes(12).toString('base64url')
}

export function newEditToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Constant-time: how long a comparison takes must not say how close a guess was. */
export function tokenMatches(token: string | null | undefined, expectedHash: string): boolean {
  if (!token || !EDIT_TOKEN.test(token)) return false
  const actual = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Reads the token out of `Authorization: Bearer <token>`. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '')
  return match ? match[1]! : null
}

/** A world's current version as an entity tag. Strong, because the bytes are exact. */
export function versionTag(version: number): string {
  return `"${version}"`
}

/**
 * Parses `If-Match` into the version it names.
 *
 * Returns null for anything that is not exactly one strong tag holding a
 * non-negative integer. A write without a usable precondition is refused
 * rather than treated as unconditional: the unconditional write is precisely
 * the one that loses someone else's edit.
 */
export function parseIfMatch(header: string | null | undefined): number | null {
  const match = /^"(\d{1,9})"$/.exec(header?.trim() ?? '')
  return match ? Number(match[1]) : null
}

export function newMeta(tokenHash: string, now = new Date()): WorldMeta {
  const at = now.toISOString()
  return { v: 1, tokenHash, version: 0, createdAt: at, updatedAt: at }
}

/** Storage keys. Colons are unstorage's own separator, so every backend nests them. */
export const keys = {
  meta: (id: string) => `worlds:${id}:meta`,
  doc: (id: string) => `worlds:${id}:doc`,
  photos: (id: string) => `worlds:${id}:photos`,
  photo: (id: string, name: string) => `worlds:${id}:photos:${name}`,
}

/**
 * Checks a request body against a byte ceiling, using the declared length
 * before anything is read and the real length afterwards - a client can lie
 * about the first.
 */
export function sizeProblem(declared: string | null | undefined, actual: number | null, limit: number): string | null {
  const length = declared == null || declared === '' ? null : Number(declared)
  if (length != null && Number.isFinite(length) && length > limit) return `Too large: the limit is ${limit} bytes.`
  if (actual != null && actual > limit) return `Too large: the limit is ${limit} bytes.`
  if (actual === 0) return 'The body is empty.'
  return null
}

/** Netlify sets x-nf-client-connection-ip; fall back to the standard header. */
export function clientIp(nfIp: string | null | undefined, forwarded: string | null | undefined): string {
  const raw = nfIp || forwarded
  return raw?.split(',')[0]?.trim() || 'unknown'
}
