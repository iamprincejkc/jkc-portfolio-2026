import { SESSION_COOKIE, scopeSatisfies, verifySessionToken, type Scope } from '../utils/auth'

/**
 * The PIN gate.
 *
 * Runs before every server request and turns away anything aimed at /gallery
 * without a valid signed session cookie. /gate and the endpoint that issues
 * sessions are the only public surface.
 *
 * The rest of the portfolio is untouched by this - the homepage is prerendered
 * and never reaches here in production.
 */

const GUARDED_PREFIXES = ['/gallery', '/api/gallery']

/** Endpoints that must stay reachable without a session. */
const PUBLIC_PATHS = new Set(['/api/gallery/session'])

/** Only ever bounce to a path on this origin - never an attacker-supplied URL. */
function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/gallery'
  return next
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname

  const isGate = path === '/gate'
  const isGuarded = GUARDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )

  if (!isGate && !isGuarded) return
  if (PUBLIC_PATHS.has(path)) return

  // Coerced: Nuxt parses env values with `destr`, so config values are not
  // guaranteed to be strings even when the default is one.
  const secret = String(useRuntimeConfig().authSecret ?? '')

  if (!secret || secret.length < 32) {
    // Fail closed. A misconfigured secret must never mean "everyone gets in".
    if (isGate) return
    throw createError({
      statusCode: 503,
      statusMessage: 'The gallery is not configured. NUXT_AUTH_SECRET is missing.',
    })
  }

  const scope = verifySessionToken(getCookie(event, SESSION_COOKIE), secret)

  if (isGate) {
    /*
     * Don't show the gate to someone already through it - but only if they hold
     * the scope this visit asks for. A viewer landing on `/gate?scope=admin`
     * still needs the admin prompt, otherwise escalation is impossible without
     * signing out first.
     */
    const wanted: Scope = url.searchParams.get('scope') === 'admin' ? 'admin' : 'site'
    if (scopeSatisfies(scope, wanted)) {
      return sendRedirect(event, safeNext(url.searchParams.get('next')), 302)
    }
    return
  }

  const required: Scope = path.startsWith('/gallery/admin') || path.startsWith('/api/gallery/admin')
    ? 'admin'
    : 'site'

  if (scopeSatisfies(scope, required)) return

  // APIs get a status code; humans get the gate.
  if (path.startsWith('/api/')) {
    throw createError({
      statusCode: scope ? 403 : 401,
      statusMessage: scope ? 'Insufficient privileges.' : 'Not authenticated.',
    })
  }

  const target = new URL('/gate', url.origin)
  target.searchParams.set('next', `${path}${url.search}`)
  if (required === 'admin') target.searchParams.set('scope', 'admin')

  setResponseHeader(event, 'cache-control', 'no-store')
  return sendRedirect(event, `${target.pathname}${target.search}`, 302)
})
