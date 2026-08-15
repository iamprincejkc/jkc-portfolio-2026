/**
 * Cloudinary delivery URLs.
 *
 * Cloudinary is already a transforming CDN, so it does the resizing and format
 * negotiation: `f_auto` picks AVIF/WebP per browser and `q_auto` picks a
 * quality per image, which beats any fixed number. Routing the same bytes
 * through another optimiser would add a hop for no benefit.
 */

/** Wider than this is wasted bandwidth for a web gallery. */
const WIDTHS = [420, 640, 828, 1080, 1280, 1600, 1920, 2560]

export function useCloudinaryImage() {
  const cloudName = useRuntimeConfig().public.cloudinaryCloudName as string

  function url(publicId: string, width: number, extra?: string): string {
    if (!cloudName) return ''
    const transforms = ['f_auto', 'q_auto', 'c_limit', `w_${width}`, 'fl_progressive']
    if (extra) transforms.push(extra)
    return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(',')}/${publicId}`
  }

  function srcset(publicId: string): string {
    if (!cloudName) return ''
    return WIDTHS.map((width) => `${url(publicId, width)} ${width}w`).join(', ')
  }

  /** A sensible default source for browsers that ignore srcset. */
  function src(publicId: string): string {
    return url(publicId, 1280)
  }

  return { url, srcset, src, cloudName }
}
