import { keys } from '../../../../../utils/evently'
import { eventlyStore, photoNameParam, sendOpaque, worldIdParam } from '../../../../../utils/evently-store'

/**
 * One encrypted photo.
 *
 * The browser gives every upload a fresh random name and never reuses one, so
 * the bytes behind a name never change and the browser may keep them for good.
 * `private`, so only the viewer's own browser does.
 */
export default defineEventHandler(async (event) => {
  const id = worldIdParam(event)
  const name = photoNameParam(event)

  const bytes = await eventlyStore().getItemRaw(keys.photo(id, name))
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'No such photo.' })

  setResponseHeader(event, 'cache-control', 'private, max-age=31536000, immutable')
  return sendOpaque(event, bytes)
})
