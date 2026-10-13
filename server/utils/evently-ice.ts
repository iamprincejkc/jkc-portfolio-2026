/**
 * ICE servers for Evently's "walk together" mode.
 *
 * Two phones in the same world connect directly over WebRTC. Most networks
 * allow that with only a STUN server (free, public, stateless). Some - mobile
 * carriers behind carrier-grade NAT especially - do not, and those pairs need
 * a TURN relay that forwards their (still end-to-end encrypted) traffic.
 *
 * TURN is optional. Without Cloudflare credentials configured this hands out
 * STUN only, and the pairs that needed a relay each walk the world alone;
 * nothing else changes. With them, it mints short-lived TURN credentials from
 * Cloudflare's free tier.
 *
 * Anyone who can load a shared world can fetch these credentials and push
 * traffic through the relay until they expire. That is the accepted cost of a
 * relay without accounts; the free tier's monthly allowance is the ceiling.
 */

export type IceServer = { urls: string | string[]; username?: string; credential?: string }

export const STUN_ONLY: IceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]

/** Credentials are minted for a day and reused for half of it, so each one handed out lives at least 12 hours. */
export const TURN_TTL_SECONDS = 24 * 60 * 60
export const TURN_REUSE_MS = 12 * 60 * 60 * 1000

/**
 * Cloudflare also returns relay URLs on port 53, which browsers block; left in,
 * they only add connection attempts that time out. Anything that is not a
 * stun/turn/turns URL is dropped too.
 */
export function usableIceServers(raw: unknown): IceServer[] {
  const list = (raw as { iceServers?: unknown })?.iceServers
  if (!Array.isArray(list)) return []
  const out: IceServer[] = []
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue
    const e = entry as Record<string, unknown>
    const urls = [e.urls]
      .flat()
      .filter((u): u is string => typeof u === 'string' && /^(stun|turns?):/.test(u) && !/:53(\?|$)/.test(u))
    if (urls.length === 0) continue
    const server: IceServer = { urls }
    if (typeof e.username === 'string') server.username = e.username
    if (typeof e.credential === 'string') server.credential = e.credential
    out.push(server)
  }
  return out
}
