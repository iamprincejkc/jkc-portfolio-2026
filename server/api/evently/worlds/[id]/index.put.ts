import { EVENTLY_LIMITS, keys, parseIfMatch, versionTag, type WorldMeta } from '../../../../utils/evently'
import { eventlyStore, noStore, readOpaqueBody, requireEditor, worldIdParam } from '../../../../utils/evently-store'

/**
 * Replaces the encrypted world document.
 *
 * `If-Match` is required and must name the version the editor started from.
 * A world can be shared for editing, so two people can have it open at once;
 * without the precondition the second save silently erases the first. On a
 * mismatch the current version comes back as the ETag and the browser decides
 * what to do with the difference, since only the browser can read it.
 *
 * The check and the write are two storage calls, not one transaction. The
 * window between them is a few milliseconds on a document edited by hand by
 * one or two people, which is an acceptable trade for not needing a database.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const id = worldIdParam(event)
  const meta = await requireEditor(event, id)

  const expected = parseIfMatch(getRequestHeader(event, 'if-match'))
  if (expected == null) {
    throw createError({ statusCode: 428, statusMessage: 'Saving needs the version you started from (If-Match).' })
  }
  if (expected !== meta.version) {
    setResponseHeader(event, 'etag', versionTag(meta.version))
    throw createError({ statusCode: 412, statusMessage: 'Someone else saved this world since you opened it.' })
  }

  const body = await readOpaqueBody(event, EVENTLY_LIMITS.docBytes)
  const store = eventlyStore()
  await store.setItemRaw(keys.doc(id), body)

  const next: WorldMeta = { ...meta, version: meta.version + 1, updatedAt: new Date().toISOString() }
  await store.setItem(keys.meta(id), next)

  setResponseHeader(event, 'etag', versionTag(next.version))
  return { version: next.version }
})
