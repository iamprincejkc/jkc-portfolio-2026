import type { Photo } from './cloudinary'

export type MonthsaryPhoto = { publicId: string; color: string }

/**
 * What /monthsary may see of the gallery.
 *
 * That page has no PIN, so this is the whole of what the gallery gives away
 * there: images only, and nothing but the id the delivery URL is built from
 * plus the colour painted while it loads. Titles, clients, years and tags stay
 * behind the gate. Delivery URLs are already public on Cloudinary - what the
 * PIN guards is the listing, and this is a deliberately thin one.
 */
export function monthsaryPhotos(photos: Photo[]): MonthsaryPhoto[] {
  return photos
    .filter((photo) => photo.kind === 'image')
    .map(({ publicId, color }) => ({ publicId, color }))
}
