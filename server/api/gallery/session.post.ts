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
   * Nuxt parses environment values with `destr`, so an all-digits PIN arrives
   * as a number rather than a string. Coerce before any crypto touches it -
   * `createHmac().update()` rejects non-string input outright.
   *
   * A leading zero keeps it a string (invalid JSON), which is a difference
   * worth knowing but not worth relying on.
   */
  const secret = String(config.authSecret ?? '')
  const sitePin = String(config.sitePin ?? '')
  const adminPin = String(config.adminPin ?? '')

  const required = scope === 'admin' ? adminPin : sitePin
  if (!secret || secret.length < 32 || !required) {
    throw createError({
      statusCode: 503,
      statusMessage: 'The gallery is not configured yet.',
    })
  }

  /*
   * An admin outranks a viewer everywhere else in this system, so the admin
   * PIN is accepted on the viewing gate too and simply grants the higher
   * scope. Previously it was only checked at /gallery/admin, which meant the
   * admin PIN was rejected at /gallery - confusing, and for no benefit.
   *
   * Both comparisons always run. Returning early on the first match would
   * make the response time reveal which PIN was entered.
   */
  const matchesRequired = safeEqual(pin, required)
  const matchesAdmin = adminPin ? safeEqual(pin, adminPin) : false

  if (!matchesRequired && !matchesAdmin) {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect PIN.' })
  }

  const granted: Scope = matchesAdmin ? 'admin' : scope

  resetKey(key)

  setCookie(event, SESSION_COOKIE, createSessionToken(granted, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: granted === 'admin' ? ADMIN_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
  })

  return { ok: true, scope: granted }
})
