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

export function useCloudinaryImage() {
  const cloudName = useRuntimeConfig().public.cloudinaryCloudName as string

  function base(kind: 'image' | 'video', transforms: string[], publicId: string): string {
    if (!cloudName) return ''
    return `https://res.cloudinary.com/${cloudName}/${kind}/upload/${transforms.join(',')}/${publicId}`
  }

  function url(publicId: string, width: number, extra?: string): string {
    const transforms = ['f_auto', 'q_auto', 'c_limit', `w_${width}`, 'fl_progressive']
    if (extra) transforms.push(extra)
    return base('image', transforms, publicId)
  }

  function srcset(publicId: string): string {
    if (!cloudName) return ''
    return WIDTHS.map((width) => `${url(publicId, width)} ${width}w`).join(', ')
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
