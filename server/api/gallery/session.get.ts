import { SESSION_COOKIE, verifySessionToken } from '../../utils/auth'

/**
 * Reports the scope of the current session, so the gallery chrome can decide
 * whether to show admin-only controls. Reaching this at all means the gate
 * middleware already accepted the session.
 */
export default defineEventHandler((event) => {
  const secret = String(useRuntimeConfig().authSecret ?? '')
  const scope = secret ? verifySessionToken(getCookie(event, SESSION_COOKIE), secret) : null
  return { scope }
})
