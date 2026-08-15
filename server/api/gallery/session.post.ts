import type { H3Event } from 'h3'
import {
  ADMIN_SESSION_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  safeEqual,
  type Scope,
} from '../../utils/auth'
import { consume, resetKey } from '../../utils/rate-limit'

/**
 * Issues a session. This is the only unauthenticated gallery endpoint.
 *
 * The PIN is compared here, in constant time, against the server-side value.
 * Nothing about the correct PIN is ever sent to the browser.
 */

// A 6-digit PIN has a small keyspace, so the limiter is the thing actually
// standing between it and a brute-force.
const MAX_ATTEMPTS = 8
const WINDOW_SECONDS = 10 * 60

function clientKey(event: H3Event): string {
  // Netlify sets x-nf-client-connection-ip; fall back to the standard header.
  const forwarded =
    getRequestHeader(event, 'x-nf-client-connection-ip') ||
    getRequestHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `session:${ip}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ pin?: unknown; scope?: unknown }>(event)

  const pin = typeof body?.pin === 'string' ? body.pin : ''
  const scope: Scope = body?.scope === 'admin' ? 'admin' : 'site'

  if (!pin || pin.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Malformed request.' })
  }

  const key = `${clientKey(event)}:${scope}`
  const limit = consume(key, MAX_ATTEMPTS, WINDOW_SECONDS)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
    })
  }

  const config = useRuntimeConfig()

  /*
   * Nuxt parses environment values with `destr`, so an all-digits PIN such as
   * 246810 arrives as a number, not a string. Coerce before any crypto touches
   * it - `createHmac().update()` rejects non-string input outright.
   */
  const secret = String(config.authSecret ?? '')
  const expected = String((scope === 'admin' ? config.adminPin : config.sitePin) ?? '')

  if (!secret || secret.length < 32 || !expected) {
    throw createError({
      statusCode: 503,
      statusMessage: 'The gallery is not configured yet.',
    })
  }

  if (!safeEqual(pin, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect PIN.' })
  }

  resetKey(key)

  setCookie(event, SESSION_COOKIE, createSessionToken(scope, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: scope === 'admin' ? ADMIN_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
  })

  return { ok: true, scope }
})
