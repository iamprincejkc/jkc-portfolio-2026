import { eventIds, idsSince, parseSince, shiftbellKeys } from '../../utils/shiftbell'
import { channelParam, limitChannel, readChannelMeta, requireToken, shiftbellStore } from '../../utils/shiftbell-store'
import { noStore } from '../../utils/evently-store'

/**
 * The encrypted events written to a channel since `?since=` (ms). An unclaimed channel reads as empty, so
 * a freshly paired device can poll before the first event exists.
 */
export default defineEventHandler(async (event) => {
  noStore(event)
  const channel = channelParam(event)
  limitChannel(event, channel, 'read')
  const meta = await readChannelMeta(channel)
  requireToken(event, meta)
  if (!meta) return { events: [], now: Date.now() }

  const store = shiftbellStore()
  const ids = idsSince(eventIds(await store.getKeys(shiftbellKeys.eventPrefix(channel)), channel), parseSince(getQuery(event).since))
  const events = await Promise.all(
    ids.map(async (id) => ({ id, data: await store.getItem<string>(shiftbellKeys.event(channel, id)) })),
  )
  return { events: events.filter((e) => typeof e.data === 'string'), now: Date.now() }
})
