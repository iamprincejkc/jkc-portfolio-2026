import { ConfigError } from '../../../../utils/cloudinary'
import { isR2Configured, listVault, signVaultItem } from '../../../../utils/r2'

/**
 * The private video vault, with playback and download links.
 *
 * Under /api/gallery/admin, so the gate middleware only lets an admin session
 * through - a viewer PIN never sees these videos or their links. Answers
 * `configured: false` rather than an error when R2 has not been set up, so the
 * uploader can fall back to Cloudinary for video.
 */
export default defineEventHandler(async () => {
  if (!isR2Configured()) return { configured: false, items: [] }

  try {
    const now = new Date()
    const items = await listVault()
    return { configured: true, items: items.map((item) => signVaultItem(item, now)) }
  } catch (error) {
    if (error instanceof ConfigError) return { configured: false, items: [] }
    throw createError({ statusCode: 502, statusMessage: 'Could not reach R2.' })
  }
})
