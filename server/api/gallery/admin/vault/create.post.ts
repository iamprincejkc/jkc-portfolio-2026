import { createVaultUpload, extensionOf, MAX_OBJECT_BYTES, VIDEO_TYPES, vaultHttpError } from '../../../../utils/r2'
import { consume } from '../../../../utils/rate-limit'
import { readUploadMeta, text } from '../../../../utils/upload-meta'

/**
 * Starts a multipart upload into the vault, and tells the browser how to cut
 * the file into parts.
 *
 * Admin-only via the gate. The key, content type and part size are all decided
 * here; the browser only describes the file. Title, client, year and tags are
 * written onto the object now, since a multipart upload cannot add metadata
 * when it completes.
 */

const MAX_UPLOADS = 60
const WINDOW_SECONDS = 60

/** Pixels, as measured by the uploading browser; 0 when it could not tell. */
function dimension(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 && number <= 16384 ? Math.round(number) : 0
}

export default defineEventHandler(async (event) => {
  const limit = consume('vault-create', MAX_UPLOADS, WINDOW_SECONDS)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({ statusCode: 429, statusMessage: 'Slow down - too many uploads at once.' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const { title, client, year, tags } = readUploadMeta(body)

  const filename = text(body?.filename, 200)
  // Whitelisted by extension: this becomes the stored content type, which
  // decides how the signed playback link is served.
  const contentType = VIDEO_TYPES[extensionOf(filename)]
  if (!filename || !contentType) {
    throw createError({ statusCode: 400, statusMessage: 'Only MP4, MOV, M4V and WebM video can be stored.' })
  }

  const size = Number(body?.size)
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_OBJECT_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file size.' })
  }

  const rawDuration = Number(body?.duration)
  const duration =
    Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration < 1e6 ? rawDuration : undefined

  try {
    return await createVaultUpload({
      filename,
      size,
      contentType,
      meta: {
        title,
        client,
        year,
        tags,
        filename,
        width: dimension(body?.width),
        height: dimension(body?.height),
        duration,
        hasPoster: body?.poster === true,
      },
    })
  } catch (error) {
    throw vaultHttpError(error)
  }
})
