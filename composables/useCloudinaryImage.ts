/**
 * Cloudinary delivery URLs.
 *
 * Cloudinary is already a transforming CDN, so it does the resizing and format
 * negotiation: `f_auto` picks AVIF/WebP (or a suitable video codec) per
 * browser and `q_auto` picks a quality per asset, which beats any fixed
 * number. Routing the same bytes through another optimiser would add a hop
 * for no benefit.
 *
 * Video lives under a different resource type in the URL path, so it needs its
 * own builders rather than a flag on the image one.
 */

/** Wider than this is wasted bandwidth for a web gallery. */
const WIDTHS = [420, 640, 828, 1080, 1280, 1600, 1920, 2560]

/** Columns at each tier. The feed is uniform-width masonry, so a tile's
 *  width depends only on how many columns there are - not on its position.
 *
 *  Must match the `.feed` column-count rules in assets/css/main.css. A drift
 *  between them costs bandwidth silently, so the tests pin them together. */
const COLUMNS: Record<'s' | 'm' | 'l', number> = { l: 2, m: 3, s: 4 }
const TABLET_COLUMNS = 2

/** Container max-width minus its horizontal padding, at the large breakpoint. */
const CONTENT_MAX = 1600 - 96

/**
 * A `sizes` value matching what a tile will actually occupy.
 *
 * This matters more than any transformation setting: `sizes` is the browser's
 * only input when choosing from `srcset`, and over-declaring it makes every
 * image bigger than it needs to be. A four-column tile that claims the
 * two-column width fetches roughly four times the pixels it can display.
 */
export function tileSizes(density: 's' | 'm' | 'l' = 'm'): string {
  const columns = COLUMNS[density]
  const vw = (n: number) => Math.round(100 / n)

  return [
    // Past the container's max width the tile stops growing, so vw would keep
    // over-estimating.
    `(min-width: 1600px) ${Math.round(CONTENT_MAX / columns)}px`,
    `(min-width: 1024px) ${vw(columns)}vw`,
    `(min-width: 640px) ${vw(TABLET_COLUMNS)}vw`,
    '100vw',
  ].join(', ')
}

export function useCloudinaryImage() {
  const cloudName = useRuntimeConfig().public.cloudinaryCloudName as string

  function base(kind: 'image' | 'video', transforms: string[], publicId: string): string {
    if (!cloudName) return ''
    return `https://res.cloudinary.com/${cloudName}/${kind}/upload/${transforms.join(',')}/${publicId}`
  }

  /**
   * `quality` maps to Cloudinary's automatic tiers rather than a fixed number,
   * so it adapts per image instead of over-compressing flat ones and
   * under-compressing detailed ones.
   *
   * `eco` is used for grid tiles: at thumbnail size the difference from `good`
   * is not visible, and it typically cuts 25-40% of the bytes. Full-size views
   * stay on `good`, where it would be.
   */
  function url(
    publicId: string,
    width: number,
    options: { quality?: 'good' | 'eco' | 'best'; extra?: string } = {},
  ): string {
    const transforms = [
      'f_auto',
      `q_auto:${options.quality ?? 'good'}`,
      'c_limit',
      `w_${width}`,
      'fl_progressive',
    ]
    if (options.extra) transforms.push(options.extra)
    return base('image', transforms, publicId)
  }

  function srcset(
    publicId: string,
    options: { quality?: 'good' | 'eco' | 'best'; maxWidth?: number } = {},
  ): string {
    if (!cloudName) return ''
    const widths = options.maxWidth
      ? WIDTHS.filter((w) => w <= options.maxWidth!)
      : WIDTHS
    return widths.map((width) => `${url(publicId, width, options)} ${width}w`).join(', ')
  }

  /** A sensible default source for browsers that ignore srcset. */
  function src(publicId: string): string {
    return url(publicId, 1280)
  }

  /**
   * A still frame from the video, used as the poster.
   *
   * `so_0` seeks to the first second rather than 0 - the very first frame of a
   * phone recording is often black or mid-exposure, which makes a whole grid
   * of videos look broken.
   */
  function videoPoster(publicId: string, width = 1280): string {
    return base('video', ['so_1', 'f_auto', 'q_auto', 'c_limit', `w_${width}`], `${publicId}.jpg`)
  }

  /** Transcoded video source. Cloudinary picks the container via `f_auto`. */
  function videoSrc(publicId: string, width = 1280): string {
    return base('video', ['f_auto', 'q_auto', 'c_limit', `w_${width}`], publicId)
  }

  /** Poster for whichever kind the asset is, so tiles can stay generic. */
  function posterFor(media: { publicId: string; kind: 'image' | 'video' }, width = 1280): string {
    return media.kind === 'video' ? videoPoster(media.publicId, width) : url(media.publicId, width)
  }

  return { url, srcset, src, videoPoster, videoSrc, posterFor, cloudName }
}

/** mm:ss for a duration in seconds. */
export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
