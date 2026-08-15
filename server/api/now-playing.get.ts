/**
 * Now playing, straight from the Spotify Web API.
 *
 * Replaces a third-party widget whose shared OAuth token kept getting revoked -
 * it returned `200 text/html` with an error string in place of an SVG, so the
 * browser painted a broken image in the middle of the hero.
 *
 * Here the refresh token is ours and lives in server config. The browser only
 * ever receives track name, artist and cover art; no credential is exposed.
 */

type SpotifyImage = { url: string; width: number; height: number }

type SpotifyTrack = {
  name: string
  artists: { name: string }[]
  album: { name: string; images: SpotifyImage[] }
  external_urls: { spotify: string }
  duration_ms: number
}

export type NowPlaying =
  | { configured: false }
  | { configured: true; playing: false; track: null }
  | {
      configured: true
      playing: boolean
      track: {
        title: string
        artist: string
        album: string
        albumArt: string | null
        url: string
        progressMs: number
        durationMs: number
      }
    }

/*
 * An access token is good for an hour. Minting one per request would triple the
 * latency of the card and burn rate limit for nothing, so it is held in module
 * scope. Per-instance, which is exactly the right lifetime here.
 */
let cachedToken: { value: string; expiresAt: number } | null = null

/** Spotify's rate limit is per-app; the card does not need second-by-second truth. */
const RESPONSE_TTL_MS = 20_000
let cachedResponse: { value: NowPlaying; at: number } | null = null

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const data = await $fetch<{ access_token: string; expires_in: number }>(
    'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    },
  )

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.value
}

function shape(track: SpotifyTrack, playing: boolean, progressMs: number): NowPlaying {
  // Images come largest-first; the card is small, so take the smallest that is
  // still bigger than the rendered size.
  const images = [...(track.album.images ?? [])].sort((a, b) => a.width - b.width)
  const art = images.find((i) => i.width >= 160) ?? images.at(-1) ?? null

  return {
    configured: true,
    playing,
    track: {
      title: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      album: track.album.name,
      albumArt: art?.url ?? null,
      url: track.external_urls.spotify,
      progressMs,
      durationMs: track.duration_ms,
    },
  }
}

export default defineEventHandler(async (event): Promise<NowPlaying> => {
  const config = useRuntimeConfig()

  // Coerced: Nuxt parses env with `destr`, so values are not guaranteed strings.
  const clientId = String(config.spotifyClientId ?? '')
  const clientSecret = String(config.spotifyClientSecret ?? '')
  const refreshToken = String(config.spotifyRefreshToken ?? '')

  // Not an error - the hero simply omits the card until this is set up.
  if (!clientId || !clientSecret || !refreshToken) {
    return { configured: false }
  }

  if (cachedResponse && Date.now() - cachedResponse.at < RESPONSE_TTL_MS) {
    setResponseHeader(event, 'cache-control', 'public, max-age=20')
    return cachedResponse.value
  }

  try {
    const token = await getAccessToken(clientId, clientSecret, refreshToken)
    const auth = { Authorization: `Bearer ${token}` }

    // 204 No Content means nothing is playing right now.
    const current = await $fetch<{
      is_playing: boolean
      progress_ms: number
      item: SpotifyTrack | null
    } | null>('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: auth,
      // Podcasts and local files come back without a usable track shape.
      query: { additional_types: 'track' },
    }).catch(() => null)

    let result: NowPlaying

    if (current?.item) {
      result = shape(current.item, current.is_playing, current.progress_ms ?? 0)
    } else {
      // Fall back to the last thing played, so the card says something real
      // rather than disappearing whenever the music stops.
      const recent = await $fetch<{ items: { track: SpotifyTrack }[] }>(
        'https://api.spotify.com/v1/me/player/recently-played',
        { headers: auth, query: { limit: 1 } },
      ).catch(() => null)

      const track = recent?.items?.[0]?.track
      result = track ? shape(track, false, 0) : { configured: true, playing: false, track: null }
    }

    cachedResponse = { value: result, at: Date.now() }
    setResponseHeader(event, 'cache-control', 'public, max-age=20')
    return result
  } catch (error) {
    console.error('[now-playing] Spotify request failed:', error)
    // Serve stale rather than flashing the card away on a blip.
    if (cachedResponse) return cachedResponse.value
    return { configured: true, playing: false, track: null }
  }
})
