/**
 * Now playing, via Last.fm scrobbles.
 *
 * Spotify's Web API is gated behind Premium on this account, and the
 * third-party widget it replaced kept having its shared OAuth token revoked -
 * signalling failure with `200 text/html`, so the browser painted a broken
 * image in the hero. Last.fm needs only a read-only API key, works on a free
 * Spotify tier, and has no token to expire.
 *
 * Trade-off: Last.fm reports the most recent *scrobble*. A track is normally
 * scrobbled part-way through, and `nowplaying` is only set while Spotify is
 * actively reporting, so this usually reads "Last played" rather than live
 * playback. There is no progress or duration in this response.
 */

/** Last.fm returns this hash for "no artwork", not an empty string. */
const PLACEHOLDER_ART = '2a96cbd8b46e442fc41c2b86b821562f'

type LastfmImage = { '#text': string; size: 'small' | 'medium' | 'large' | 'extralarge' }

type LastfmTrack = {
  name: string
  url: string
  artist: { '#text': string }
  album: { '#text': string }
  image: LastfmImage[]
  '@attr'?: { nowplaying?: string }
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
      }
    }

/*
 * Last.fm allows roughly 5 requests/second per key. The card polls every 30s
 * per visitor, so a burst of traffic could add up. Caching in module scope
 * collapses all of it to one upstream call per instance per window.
 */
const RESPONSE_TTL_MS = 20_000
let cached: { value: NowPlaying; at: number } | null = null

function pickArt(images: LastfmImage[] | undefined): string | null {
  if (!Array.isArray(images)) return null
  const order: LastfmImage['size'][] = ['extralarge', 'large', 'medium', 'small']
  for (const size of order) {
    const url = images.find((i) => i.size === size)?.['#text']
    if (url && !url.includes(PLACEHOLDER_ART)) return url
  }
  return null
}

export default defineEventHandler(async (event): Promise<NowPlaying> => {
  const config = useRuntimeConfig()

  // Coerced: Nuxt parses env with `destr`, so values are not guaranteed strings.
  const apiKey = String(config.lastfmApiKey ?? '')
  const user = String(config.lastfmUser ?? '')

  // Not an error - the hero simply omits the card until this is set up.
  if (!apiKey || !user) return { configured: false }

  if (cached && Date.now() - cached.at < RESPONSE_TTL_MS) {
    setResponseHeader(event, 'cache-control', 'public, max-age=20')
    return cached.value
  }

  try {
    const data = await $fetch<{ recenttracks?: { track?: LastfmTrack[] | LastfmTrack } }>(
      'https://ws.audioscrobbler.com/2.0/',
      {
        query: {
          method: 'user.getrecenttracks',
          user,
          api_key: apiKey,
          format: 'json',
          limit: 1,
        },
        // Never let a slow upstream hold the page render hostage.
        timeout: 6000,
      },
    )

    // The API returns an object rather than an array when limit resolves to one.
    const raw = data.recenttracks?.track
    const track = Array.isArray(raw) ? raw[0] : raw

    const result: NowPlaying = track
      ? {
          configured: true,
          playing: track['@attr']?.nowplaying === 'true',
          track: {
            title: track.name,
            artist: track.artist?.['#text'] ?? '',
            album: track.album?.['#text'] ?? '',
            albumArt: pickArt(track.image),
            url: track.url,
          },
        }
      : { configured: true, playing: false, track: null }

    cached = { value: result, at: Date.now() }
    setResponseHeader(event, 'cache-control', 'public, max-age=20')
    return result
  } catch (error) {
    console.error('[now-playing] Last.fm request failed:', error)
    // Serve stale rather than flashing the card away on a blip.
    if (cached) return cached.value
    return { configured: true, playing: false, track: null }
  }
})
