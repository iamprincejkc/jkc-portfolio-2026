import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Session handling for the /gallery PIN gate.
 *
 * A session is a stateless, HMAC-signed token stored in an httpOnly cookie.
 * There is no database: the only secret is `AUTH_SECRET`, and a token is only
 * trusted if its signature verifies and it has not expired.
 */

export const SESSION_COOKIE = 'jkc_gallery'

export type Scope = 'site' | 'admin'

/** `admin` implies `site` - an admin can do everything a viewer can. */
const SCOPE_RANK: Record<Scope, number> = { site: 1, admin: 2 }

export const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 2 // 2 hours - shorter blast radius

type Payload = {
  /** scope */
  s: Scope
  /** expiry, unix seconds */
  e: number
  /** nonce, so two tokens minted in the same second still differ */
  n: string
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(data: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest())
}

/**
 * Compare two secrets without leaking their contents (or lengths) through
 * timing. Hashing first normalises length so `timingSafeEqual` never throws.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'pin-compare').update(a).digest()
  const hb = createHmac('sha256', 'pin-compare').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function createSessionToken(
  scope: Scope,
  secret: string,
  ttlSeconds = scope === 'admin' ? ADMIN_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
  now = Date.now(),
): string {
  const payload: Payload = {
    s: scope,
    e: Math.floor(now / 1000) + ttlSeconds,
    n: randomBytes(6).toString('hex'),
  }
  const body = base64url(JSON.stringify(payload))
  return `${body}.${sign(body, secret)}`
}

/**
 * Verify a token and return its scope, or `null` if it is missing, malformed,
 * tampered with, or expired.
 */
export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  now = Date.now(),
): Scope | null {
  if (!token) return null

  const dot = token.indexOf('.')
  if (dot <= 0) return null

  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  const expected = sign(body, secret)
  const a = fromBase64url(signature)
  const b = fromBase64url(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: Payload
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as Payload
  } catch {
    return null
  }

  if (payload.s !== 'site' && payload.s !== 'admin') return null
  if (typeof payload.e !== 'number' || payload.e * 1000 <= now) return null

  return payload.s
}

/** Does `held` satisfy a requirement of `required`? */
export function scopeSatisfies(held: Scope | null, required: Scope): boolean {
  if (!held) return false
  return SCOPE_RANK[held] >= SCOPE_RANK[required]
}
