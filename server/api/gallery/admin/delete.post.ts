import { ConfigError, deletePhoto } from '../../../utils/cloudinary'

/** Deletes one frame. Admin-only via the gate middleware. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ publicId?: unknown }>(event)
  const publicId = typeof body?.publicId === 'string' ? body.publicId.trim() : ''

  if (!publicId) {
    throw createError({ statusCode: 400, statusMessage: 'publicId is required.' })
  }

  try {
    await deletePhoto(publicId)
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
