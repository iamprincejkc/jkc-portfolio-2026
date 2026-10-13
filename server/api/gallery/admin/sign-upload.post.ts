import { ConfigError, createUploadTicket } from '../../../utils/cloudinary'
import { consume } from '../../../utils/rate-limit'
import { readUploadMeta } from '../../../utils/upload-meta'

/**
 * Mints a signed Cloudinary upload ticket.
 *
 * The gate middleware already requires an admin session for /api/gallery/admin,
 * so this handler is only ever reached by an admin. Every signed parameter is
 * decided server-side in `createUploadTicket`.
 */

const MAX_TICKETS = 60
const WINDOW_SECONDS = 60

export default defineEventHandler(async (event) => {
  const limit = consume('sign-upload', MAX_TICKETS, WINDOW_SECONDS)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({ statusCode: 429, statusMessage: 'Slow down - too many uploads at once.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const { title, client, year, alt, color, tags } = readUploadMeta(body)

  // Whitelisted rather than trusted: this decides which Cloudinary endpoint
  // the ticket points at, so an unrecognised value must not fall through.
  const kind = body?.kind === 'video' ? 'video' : 'image'

  try {
    return createUploadTicket({ title, client, year, alt, color }, tags, kind)
  } catch (error) {
    if (error instanceof ConfigError) {
      throw createError({ statusCode: 503, statusMessage: error.message })
    }
    throw error
  }
})
