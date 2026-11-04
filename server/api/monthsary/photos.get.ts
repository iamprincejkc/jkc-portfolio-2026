import { ConfigError, isCloudinaryConfigured, listPhotos } from '../../utils/cloudinary'
import { monthsaryPhotos } from '../../utils/monthsary'

/**
 * The photos /monthsary builds its words from.
 *
 * Public on purpose: the page is meant to open from a link with no PIN. The
 * gate middleware only guards `/gallery` and `/api/gallery`, so this sits
 * outside it, and `monthsaryPhotos` decides how little it reveals.
 *
 * Shares `listPhotos`' in-memory cache with the gallery, so a busy evening on
 * this page costs Cloudinary's rate-limited Admin API one call per instance
 * every five minutes. An unconfigured or unreachable Cloudinary answers an
 * empty list rather than an error: the page then builds its tiles from
 * colours and still says what it came to say.
 */
export default defineEventHandler(async (event) => {
  if (!isCloudinaryConfigured()) return { photos: [] }

  try {
    const photos = monthsaryPhotos(await listPhotos())
    setResponseHeader(event, 'cache-control', 'public, max-age=300')
    return { photos }
  } catch (error) {
    if (error instanceof ConfigError) return { photos: [] }
    throw createError({ statusCode: 502, statusMessage: 'Could not reach Cloudinary.' })
  }
})
