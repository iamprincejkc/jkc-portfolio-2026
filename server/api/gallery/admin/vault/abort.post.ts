import { abortVaultUpload, isUploadId, isVideoKey, vaultHttpError } from '../../../../utils/r2'

/**
 * Abandons an upload and frees the parts already sent. Admin-only via the gate.
 *
 * Best effort from the browser's side: if this never arrives, the bucket's
 * lifecycle rule removes the parts after a week anyway.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ key?: unknown; uploadId?: unknown }>(event)

  if (!isVideoKey(body?.key) || !isUploadId(body?.uploadId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid upload.' })
  }

  try {
    await abortVaultUpload(body.key, body.uploadId)
    return { ok: true }
  } catch (error) {
    throw vaultHttpError(error)
  }
})
