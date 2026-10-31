import { dataProblem, eventIds, hashAccessToken, idsToPrune, newEventId, shiftbellKeys, type ChannelMeta } from '../../utils/shiftbell'
import { channelParam, limitChannel, readChannelMeta, requireToken, shiftbellStore } from '../../utils/shiftbell-store'
import { noStore } from '../../utils/evently-store'

/**
 * Appends one encrypted event. The first write claims the channel for the caller's token; both paired
 * devices derive the same token, so whichever writes first, the other is accepted after it.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const channel = channelParam(event)
  limitChannel(event, channel, 'write')
  const meta = await readChannelMeta(channel)
  const token = requireToken(event, meta)

  const body = await readBody<{ data?: unknown }>(event).catch(() => null)
  const problem = dataProblem(body?.data)
  if (problem) throw createError({ statusCode: 400, statusMessage: problem })

  const store = shiftbellStore()
  if (!meta) {
    const claim: ChannelMeta = { v: 1, tokenHash: hashAccessToken(token), createdAt: Date.now() }
    await store.setItem(shiftbellKeys.meta(channel), claim)
  }

  const id = newEventId()
  await store.setItem(shiftbellKeys.event(channel, id), body!.data as string)

  // Housekeeping on a write, not on a timer: nothing else runs here.
  const stale = idsToPrune(eventIds(await store.getKeys(shiftbellKeys.eventPrefix(channel)), channel))
  await Promise.all(stale.map((old) => store.removeItem(shiftbellKeys.event(channel, old))))

  setResponseStatus(event, 201)
  return { id }
})
