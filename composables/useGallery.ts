import type { Category, Photo } from '../server/utils/cloudinary'

export type { Category, Photo }

export type GalleryPayload = {
  configured: boolean
  photos: Photo[]
  categories: Category[]
}

/**
 * Fetches the gallery listing once per navigation and shares it between the
 * index, the detail page and the admin console, so moving between them does
 * not re-hit the Cloudinary Admin API.
 */
export function useGalleryPhotos() {
  return useFetch<GalleryPayload>('/api/gallery/photos', {
    key: 'gallery-photos',
    default: () => ({ configured: false, photos: [], categories: [] }),
  })
}

/**
 * Video is uploaded and stored, but not shown in the public feed.
 *
 * Set to false to display it - the tiles, detail page and lightbox all handle
 * video already, so this is the only line that needs changing.
 *
 * The admin console deliberately ignores this and lists everything: hiding
 * video there too would leave uploaded clips invisible and impossible to
 * delete through the UI.
 */
export const VISIBLE_KINDS: Photo['kind'][] = ['image']

export function isVisible(photo: Photo): boolean {
  return VISIBLE_KINDS.includes(photo.kind)
}

/** Category counts for whatever subset is actually on screen. */
export function categoriesFrom(photos: Photo[]): Category[] {
  const counts = new Map<string, number>()
  for (const photo of photos) {
    for (const tag of photo.tags.length ? photo.tags : ['uncategorised']) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function galleryHref(photo: { slug: string[] }): string {
  return `/gallery/${photo.slug.map(encodeURIComponent).join('/')}`
}

export function slugKey(slug: string[]): string {
  return slug.map((segment) => decodeURIComponent(segment)).join('/')
}
