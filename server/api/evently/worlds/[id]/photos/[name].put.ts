import { EVENTLY_LIMITS, keys } from '../../../../../utils/evently'
import {
  eventlyStore,
  noStore,
  photoCount,
  photoNameParam,
  readOpaqueBody,
  requireEditor,
  worldIdParam,
} from '../../../../../utils/evently-store'

/**
 * Stores one encrypted photo under a name the browser chose.
 *
 * Writing the same name twice is allowed so that a retried upload succeeds,
 * and it does not count against the limit a second time.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const id = worldIdParam(event)
  const name = photoNameParam(event)
  await requireEditor(event, id)

  const store = eventlyStore()
  const key = keys.photo(id, name)
  const exists = await store.hasItem(key)
  if (!exists && (await photoCount(id)) >= EVENTLY_LIMITS.photos) {
    throw createError({ statusCode: 409, statusMessage: `A world can hold ${EVENTLY_LIMITS.photos} photos.` })
  }

  const body = await readOpaqueBody(event, EVENTLY_LIMITS.photoBytes)
  await store.setItemRaw(key, body)

  setResponseStatus(event, exists ? 200 : 201)
  return { name }
})
