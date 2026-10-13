import { completeVaultUpload, isUploadId, isVideoKey, MAX_PARTS, vaultHttpError } from '../../../../utils/r2'

/**
 * Stitches the uploaded parts into the finished video. Admin-only via the gate.
 *
 * Until this succeeds the parts are invisible and the video does not exist;
 * the bucket's lifecycle rule clears out any upload that never gets here.
 */

/** R2 ETags are hex, quoted or not; anything else did not come from R2. */
const ETAG = /^"?[A-Za-z0-9-]{1,128}"?$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ key?: unknown; uploadId?: unknown; parts?: unknown }>(event)

  if (!isVideoKey(body?.key) || !isUploadId(body?.uploadId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid upload.' })
  }

  const parts: { partNumber?: unknown; etag?: unknown }[] = Array.isArray(body.parts) ? body.parts : []
  const valid =
    parts.length >= 1 &&
    parts.length <= MAX_PARTS &&
    parts.every(
      (part) =>
        Number.isInteger(part?.partNumber) &&
        (part.partNumber as number) >= 1 &&
        (part.partNumber as number) <= MAX_PARTS &&
        typeof part.etag === 'string' &&
        ETAG.test(part.etag),
    ) &&
    new Set(parts.map((part) => part.partNumber)).size === parts.length

  if (!valid) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid part list.' })
  }

  try {
    await completeVaultUpload(
      body.key,
      body.uploadId,
      parts.map((part) => ({ partNumber: part.partNumber as number, etag: part.etag as string })),
    )
    return { ok: true }
  } catch (error) {
    throw vaultHttpError(error)
  }
})
