import type { H3Event } from 'h3'
import { bearerToken } from './evently'
import { ACCESS_TOKEN, CHANNEL_ID, SHIFTBELL_LIMITS, accessTokenMatches, shiftbellKeys, type ChannelMeta } from './shiftbell'
import { consume } from './rate-limit'

/**
 * Where Shiftbell's rules meet the request and the store. The `shiftbell` mount is Netlify Blobs with
 * strong consistency in production and a folder under `.data/` in development (nuxt.config.ts).
 */

export function shiftbellStore() {
  return useStorage('shiftbell')
}

export function channelParam(event: H3Event): string {
  const channel = getRouterParam(event, 'channel') ?? ''
  if (!CHANNEL_ID.test(channel)) throw createError({ statusCode: 404, statusMessage: 'No such channel.' })
  return channel
}

export async function readChannelMeta(channel: string): Promise<ChannelMeta | null> {
  const meta = await shiftbellStore().getItem<ChannelMeta>(shiftbellKeys.meta(channel))
  return meta && typeof meta === 'object' && meta.v === 1 ? meta : null
}

/** The caller's token, refused unless it is well formed and, once the channel exists, the one that made it. */
export function requireToken(event: H3Event, meta: ChannelMeta | null): string {
  const token = bearerToken(getRequestHeader(event, 'authorization'))
  if (!token || (meta ? !accessTokenMatches(token, meta.tokenHash) : !ACCESS_TOKEN.test(token))) {
    throw createError({ statusCode: 403, statusMessage: 'This device is not paired with this channel.' })
  }
  return token
}

export function limitChannel(event: H3Event, channel: string, kind: 'read' | 'write') {
  const perMinute = kind === 'read' ? SHIFTBELL_LIMITS.readsPerMinute : SHIFTBELL_LIMITS.writesPerMinute
  const limit = consume(`shiftbell-${kind}:${channel}`, perMinute, 60)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({ statusCode: 429, statusMessage: 'Too many requests for this channel. Try again shortly.' })
  }
}
