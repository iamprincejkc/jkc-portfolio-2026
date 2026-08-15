import { ConfigError, deletePhoto } from '../../../utils/cloudinary'

/** Deletes one frame. Admin-only via the gate middleware. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ publicId?: unknown; kind?: unknown }>(event)
  const publicId = typeof body?.publicId === 'string' ? body.publicId.trim() : ''

  // Images and video have separate destroy endpoints; the wrong one reports
  // "not found" and leaves the asset in place.
  const kind = body?.kind === 'video' ? 'video' : 'image'

  if (!publicId) {
    throw createError({ statusCode: 400, statusMessage: 'publicId is required.' })
  }

  try {
    await deletePhoto(publicId, kind)
    return { ok: true }
  } catch (error) {
    if (error instanceof ConfigError) {
      throw createError({ statusCode: 503, statusMessage: error.message })
    }
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Delete failed.',
    })
  }
})
