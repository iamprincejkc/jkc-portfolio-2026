import { EVENTLY_LIMITS, clientIp, hashToken, keys, newEditToken, newMeta, newWorldId } from '../../../utils/evently'
import { eventlyStore, noStore } from '../../../utils/evently-store'
import { consume } from '../../../utils/rate-limit'

/**
 * Reserves a new world and hands back its id and edit token.
 *
 * No content arrives here. The browser needs the id before it encrypts
 * anything, because the id is bound into every ciphertext as associated data:
 * that is what stops a document or a photo from one world being replayed into
 * another. A reserved world reads as "not found" until its first write.
 *
 * The token is returned exactly once. Only its hash is kept.
 */
export default defineEventHandler(async (event) => {
  noStore(event)

  const ip = clientIp(getRequestHeader(event, 'x-nf-client-connection-ip'), getRequestHeader(event, 'x-forwarded-for'))
  const limit = consume(`evently-create:${ip}`, EVENTLY_LIMITS.createPerWindow, EVENTLY_LIMITS.createWindowSeconds)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({ statusCode: 429, statusMessage: 'Too many new worlds from here. Try again later.' })
  }

  const id = newWorldId()
  const token = newEditToken()
  await eventlyStore().setItem(keys.meta(id), newMeta(hashToken(token)))

  setResponseStatus(event, 201)
  return { id, token, limits: { docBytes: EVENTLY_LIMITS.docBytes, photoBytes: EVENTLY_LIMITS.photoBytes, photos: EVENTLY_LIMITS.photos } }
})
