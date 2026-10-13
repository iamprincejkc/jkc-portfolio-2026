import { isUploadId, isVideoKey, MAX_PARTS, signPartUrls, vaultHttpError } from '../../../../utils/r2'
import { consume } from '../../../../utils/rate-limit'

/**
 * Presigns PUT URLs for a batch of parts of an upload already under way.
 *
 * Admin-only via the gate. Asked for in small batches as the upload goes, so
 * a link is never minted long before it is used, and a resumed upload only
 * asks for the parts it still needs.
 */

const MAX_BATCH = 20
const MAX_BATCHES = 600
const WINDOW_SECONDS = 60

export default defineEventHandler(async (event) => {
  const limit = consume('vault-sign', MAX_BATCHES, WINDOW_SECONDS)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({ statusCode: 429, statusMessage: 'Slow down - too many parts at once.' })
  }

  const body = await readBody<{ key?: unknown; uploadId?: unknown; partNumbers?: unknown }>(event)

  if (!isVideoKey(body?.key) || !isUploadId(body?.uploadId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid upload.' })
  }

  const partNumbers = body.partNumbers
  if (
    !Array.isArray(partNumbers) ||
    partNumbers.length < 1 ||
    partNumbers.length > MAX_BATCH ||
    !partNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_PARTS)
  ) {
    throw createError({ statusCode: 400, statusMessage: `Ask for 1-${MAX_BATCH} valid part numbers.` })
  }

  try {
    return { parts: signPartUrls(body.key, body.uploadId, partNumbers as number[]) }
  } catch (error) {
    throw vaultHttpError(error)
  }
})
