import { keys } from '../../../../utils/evently'
import { eventlyStore, noStore, requireEditor, worldIdParam } from '../../../../utils/evently-store'

/**
 * Deletes a world and every photo in it. The link stops working for everyone.
 *
 * The record goes last, so a delete that fails halfway leaves a world its
 * editor can still see and delete again, rather than orphaned photos nobody
 * holds a token for.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const id = worldIdParam(event)
  await requireEditor(event, id)

  const store = eventlyStore()
  for (const key of await store.getKeys(keys.photos(id))) await store.removeItem(key)
  await store.removeItem(keys.doc(id))
  await store.removeItem(keys.meta(id))

  setResponseStatus(event, 204)
  return null
})
