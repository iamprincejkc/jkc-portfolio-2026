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

export function galleryHref(photo: { slug: string[] }): string {
  return `/gallery/${photo.slug.map(encodeURIComponent).join('/')}`
}

export function slugKey(slug: string[]): string {
  return slug.map((segment) => decodeURIComponent(segment)).join('/')
}
