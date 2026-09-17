import { STUN_ONLY, TURN_REUSE_MS, TURN_TTL_SECONDS, usableIceServers, type IceServer } from '../../utils/evently-ice'

/**
 * ICE servers for walking a shared world together. See server/utils/evently-ice.ts.
 *
 *   NUXT_CLOUDFLARE_TURN_KEY_ID, NUXT_CLOUDFLARE_TURN_API_TOKEN
 *
 * Both unset: STUN only. Set: Cloudflare TURN credentials, minted once per
 * function instance and reused for half their lifetime, so a busy world costs
 * Cloudflare one API call per instance per twelve hours rather than one per visitor.
 */

let cached: { servers: IceServer[]; until: number } | null = null

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  // Coerced: Nuxt parses env values with `destr`, so they are not guaranteed to be strings.
  const keyId = String(config.cloudflareTurnKeyId ?? '')
  const token = String(config.cloudflareTurnApiToken ?? '')

  if (!keyId || !token) {
    setResponseHeader(event, 'cache-control', 'public, max-age=3600')
    return { iceServers: STUN_ONLY, relay: false }
  }

  // Credentials are per-deployment secrets in transit: never in a shared cache.
  setResponseHeader(event, 'cache-control', 'private, max-age=3600')

  if (cached && cached.until > Date.now()) return { iceServers: cached.servers, relay: true }

  try {
    const response = await $fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { ttl: TURN_TTL_SECONDS },
      timeout: 5000,
    })
    const servers = usableIceServers(response)
    if (servers.length === 0) throw new Error('Cloudflare returned no usable ICE servers')
    cached = { servers, until: Date.now() + TURN_REUSE_MS }
    return { iceServers: servers, relay: true }
  } catch (error) {
    // A relay outage must not stop anyone opening a world: fall back to STUN,
    // where most pairs still connect, and try Cloudflare again on the next request.
    console.warn('evently: TURN credentials unavailable, serving STUN only', error)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { iceServers: STUN_ONLY, relay: false }
  }
})
