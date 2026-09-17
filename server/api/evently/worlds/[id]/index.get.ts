import { keys, versionTag } from '../../../../utils/evently'
import { eventlyStore, readMeta, sendOpaque, worldIdParam } from '../../../../utils/evently-store'

/**
 * The encrypted world document.
 *
 * Revalidated on every visit rather than cached: an edit has to reach the
 * person it was written for the next time they open the link. The version is
 * the entity tag, so a revisit with nothing changed costs a 304.
 */
export default defineEventHandler(async (event) => {
  const id = worldIdParam(event)
  setResponseHeader(event, 'cache-control', 'private, no-cache')

  const meta = await readMeta(id)
  if (!meta || meta.version === 0) throw createError({ statusCode: 404, statusMessage: 'No such world.' })

  const tag = versionTag(meta.version)
  setResponseHeader(event, 'etag', tag)
  if (getRequestHeader(event, 'if-none-match') === tag) {
    setResponseStatus(event, 304)
    return null
  }

  const bytes = await eventlyStore().getItemRaw(keys.doc(id))
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'No such world.' })
  return sendOpaque(event, bytes)
})
