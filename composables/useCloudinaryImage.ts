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

/**
 * Column span of each tile, keyed by position in the repeating six-item
 * rhythm. Must match the `.feed` grid in assets/css/main.css - if these drift
 * apart the browser silently downloads the wrong size.
 *
 * Out of 12 columns. The tablet tier (640-1023px) is always two across; from
 * 1024px the viewer's density choice decides.
 */
const TABLET_SPANS = [7, 5, 5, 7, 6, 6]

const DESKTOP_SPANS: Record<'s' | 'm' | 'l', number[]> = {
  l: [7, 5, 5, 7, 6, 6], // two across
  m: [5, 4, 3, 4, 3, 5], // three across
  s: [3, 3, 3, 3, 3, 3], // four across
}

/** Container max-width minus its horizontal padding, at the large breakpoint. */
const CONTENT_MAX = 1600 - 96

/**
 * A `sizes` value matching what the tile will actually occupy.
 *
 * This matters more than any transformation setting: `sizes` is the browser's
 * only input when choosing from `srcset`, and over-declaring it makes every
 * image bigger than it needs to be. A tile spanning 4 of 12 columns that
 * claims 58vw fetches roughly three times the pixels it can display.
 */
export function tileSizes(index: number, density: 's' | 'm' | 'l' = 'm'): string {
  const position = index % 6
  const tablet = TABLET_SPANS[position]
  const desktop = DESKTOP_SPANS[density][position]

  const vw = (span: number) => Math.round((span / 12) * 100)
  // Past the container's max width the tile stops growing, so vw would keep
  // over-estimating.
  const cappedPx = Math.round((desktop / 12) * CONTENT_MAX)

  return [
    `(min-width: 1600px) ${cappedPx}px`,
    `(min-width: 1024px) ${vw(desktop)}vw`,
    `(min-width: 640px) ${vw(tablet)}vw`,
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
