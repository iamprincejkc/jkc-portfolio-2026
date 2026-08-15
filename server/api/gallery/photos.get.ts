import { ConfigError, categoriesOf, isCloudinaryConfigured, listPhotos } from '../../utils/cloudinary'

/**
 * The gallery listing.
 *
 * Guarded by the gate middleware, so reaching this at all means a valid
 * session. Returns an empty, non-error payload when Cloudinary has not been
 * wired up yet, so the page can show setup guidance instead of an error.
 */
export default defineEventHandler(async () => {
  if (!isCloudinaryConfigured()) {
    return { configured: false, photos: [], categories: [] }
  }

  try {
    const photos = await listPhotos()
    return { configured: true, photos, categories: categoriesOf(photos) }
  } catch (error) {
    if (error instanceof ConfigError) {
      return { configured: false, photos: [], categories: [] }
    }
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not reach Cloudinary.',
    })
  }
})
