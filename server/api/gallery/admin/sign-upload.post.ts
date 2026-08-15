import { ConfigError, createUploadTicket } from '../../../utils/cloudinary'
import { consume } from '../../../utils/rate-limit'

/**
 * Mints a signed Cloudinary upload ticket.
 *
 * The gate middleware already requires an admin session for /api/gallery/admin,
 * so this handler is only ever reached by an admin. Every signed parameter is
 * decided server-side in `createUploadTicket`.
 */

const MAX_TICKETS = 60
const WINDOW_SECONDS = 60

const TAG_PATTERN = /^[a-z0-9 _-]+$/i

export default defineEventHandler(async (event) => {
  const limit = consume('sign-upload', MAX_TICKETS, WINDOW_SECONDS)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({ statusCode: 429, statusMessage: 'Slow down - too many uploads at once.' })
  }

  const body = await readBody<Record<string, unknown>>(event)

  const text = (value: unknown, max: number): string =>
    typeof value === 'string' ? value.trim().slice(0, max) : ''

  const year = text(body?.year, 4)
  if (year && !/^\d{4}$/.test(year)) {
    throw createError({ statusCode: 400, statusMessage: 'Year must be four digits.' })
  }

  const color = text(body?.color, 7)
  if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw createError({ statusCode: 400, statusMessage: 'Colour must be #rrggbb.' })
  }

  const tags = Array.isArray(body?.tags)
    ? body.tags
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : []

  for (const tag of tags) {
    if (tag.length > 40 || !TAG_PATTERN.test(tag)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid category "${tag}". Letters, numbers, spaces, - and _ only.`,
      })
    }
  }

  try {
    return createUploadTicket(
      {
        title: text(body?.title, 120),
        client: text(body?.client, 120),
        year,
        alt: text(body?.alt, 300),
        color,
      },
      tags,
    )
  } catch (error) {
    if (error instanceof ConfigError) {
      throw createError({ statusCode: 503, statusMessage: error.message })
    }
    throw error
  }
})
