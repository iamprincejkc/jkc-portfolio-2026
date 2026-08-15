import { SESSION_COOKIE } from '../../utils/auth'

/** Signs out by clearing the session cookie. */
export default defineEventHandler((event) => {
  setCookie(event, SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: 0,
  })
  return { ok: true }
})
