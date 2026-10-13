import { keys } from '../../../../../utils/evently'
import { eventlyStore, noStore, photoNameParam, requireEditor, worldIdParam } from '../../../../../utils/evently-store'

/**
 * Removes a photo the world no longer uses. The server cannot read the world to
 * know which photos it references, so the editor's browser tidies up after a
 * successful save.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const id = worldIdParam(event)
  const name = photoNameParam(event)
  await requireEditor(event, id)

  await eventlyStore().removeItem(keys.photo(id, name))
  setResponseStatus(event, 204)
  return null
})
