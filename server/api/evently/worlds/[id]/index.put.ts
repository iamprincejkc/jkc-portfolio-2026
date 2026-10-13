import { EVENTLY_LIMITS, VERSION_HEADERS, keys, parseVersion, type WorldMeta } from '../../../../utils/evently'
import { eventlyStore, noStore, readOpaqueBody, requireEditor, worldIdParam } from '../../../../utils/evently-store'

/**
 * Replaces the encrypted world document.
 *
 * The editor must send the version it started from (VERSION_HEADERS.base). A
 * world can be shared for editing, so two people can have it open at once;
 * without that check the second save silently erases the first. On a mismatch
 * the current version comes back in VERSION_HEADERS.current and the browser
 * decides what to do with the difference, since only the browser can read it.
 *
 * The check and the write are two storage calls, not one transaction. The
 * window between them is a few milliseconds on a document edited by hand by
 * one or two people, which is an acceptable trade for not needing a database.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const id = worldIdParam(event)
  const meta = await requireEditor(event, id)

  const expected = parseVersion(getRequestHeader(event, VERSION_HEADERS.base))
  if (expected == null) {
    throw createError({ statusCode: 428, statusMessage: 'Saving needs the version you started from.' })
  }
  if (expected !== meta.version) {
    setResponseHeader(event, VERSION_HEADERS.current, String(meta.version))
    throw createError({ statusCode: 412, statusMessage: 'Someone else saved this world since you opened it.' })
  }

  const body = await readOpaqueBody(event, EVENTLY_LIMITS.docBytes)
  const store = eventlyStore()
  await store.setItemRaw(keys.doc(id), body)

  const next: WorldMeta = { ...meta, version: meta.version + 1, updatedAt: new Date().toISOString() }
  await store.setItem(keys.meta(id), next)

  setResponseHeader(event, VERSION_HEADERS.current, String(next.version))
  return { version: next.version }
})
