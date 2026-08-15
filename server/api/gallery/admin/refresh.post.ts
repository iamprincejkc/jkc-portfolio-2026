import { invalidatePhotos } from '../../../utils/cloudinary'

/**
 * Drops the cached listing after an upload, so the admin sees their own frame
 * immediately rather than waiting out the cache TTL.
 */
export default defineEventHandler(() => {
  invalidatePhotos()
  return { ok: true }
})
