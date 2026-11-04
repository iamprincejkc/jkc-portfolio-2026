import { describe, expect, it } from 'vitest'
import { toPhoto } from './cloudinary'
import { monthsaryPhotos } from './monthsary'

describe('monthsaryPhotos', () => {
  const photos = [
    toPhoto({
      public_id: 'gallery/beach',
      tags: ['travel'],
      context: { custom: { title: 'Beach', client: 'Us', color: '#aabbcc' } },
    }),
    toPhoto({ public_id: 'gallery/clip', tags: ['travel'] }, 'video'),
  ]

  it('keeps images and drops video, which cannot be a tile', () => {
    expect(monthsaryPhotos(photos).map((photo) => photo.publicId)).toEqual(['gallery/beach'])
  })

  it('gives away nothing but the id and the placeholder colour', () => {
    expect(monthsaryPhotos(photos)).toEqual([{ publicId: 'gallery/beach', color: '#aabbcc' }])
  })
})
