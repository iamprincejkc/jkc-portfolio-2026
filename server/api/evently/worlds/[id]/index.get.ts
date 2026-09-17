import { VERSION_HEADERS, keys, parseVersion } from '../../../../utils/evently'
import { eventlyStore, readMeta, sendOpaque, worldIdParam } from '../../../../utils/evently-store'

/**
 * The encrypted world document.
 *
 * Never cached: an edit has to reach the person it was written for the next
 * time they open the link. An editor checking for someone else's changes sends
 * the version it already has and gets an empty 204 while that is still current,
 * which costs one metadata read and no document transfer.
 *
 * The version is in a header of our own rather than an ETag - see
 * VERSION_HEADERS for why.
 */
export default defineEventHandler(async (event) => {
  const id = worldIdParam(event)
  setResponseHeader(event, 'cache-control', 'no-store')

  const meta = await readMeta(id)
  if (!meta || meta.version === 0) throw createError({ statusCode: 404, statusMessage: 'No such world.' })

  setResponseHeader(event, VERSION_HEADERS.current, String(meta.version))
  if (parseVersion(getRequestHeader(event, VERSION_HEADERS.known)) === meta.version) {
    setResponseStatus(event, 204)
    return null
  }

  const bytes = await eventlyStore().getItemRaw(keys.doc(id))
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'No such world.' })
  return sendOpaque(event, bytes)
})
