import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signParams, toPhoto, categoriesOf } from './cloudinary'

/**
 * `signParams` is the one piece of this app that another service validates.
 * If it drifts, uploads fail with an opaque 401 from Cloudinary, so it is
 * checked against an independent implementation of the documented algorithm
 * rather than against itself.
 */
function referenceSignature(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(toSign + secret).digest('hex')
}

describe('signParams', () => {
  it('matches the documented algorithm', () => {
    const params = { folder: 'gallery', timestamp: '1700000000', tags: 'editorial' }
    expect(signParams(params, 'abc-secret')).toBe(referenceSignature(params, 'abc-secret'))
  })

  it('is independent of key insertion order', () => {
    const a = { folder: 'gallery', timestamp: '1700000000' }
    const b = { timestamp: '1700000000', folder: 'gallery' }
    expect(signParams(a, 's')).toBe(signParams(b, 's'))
  })

  it('changes when any signed value changes', () => {
    const base = { folder: 'gallery', timestamp: '1700000000' }
    expect(signParams(base, 's')).not.toBe(
      signParams({ ...base, folder: 'elsewhere' }, 's'),
    )
  })

  it('changes with the secret', () => {
    const params = { folder: 'gallery', timestamp: '1700000000' }
    expect(signParams(params, 'one')).not.toBe(signParams(params, 'two'))
  })
})

describe('toPhoto', () => {
  it('reads metadata from nested custom context', () => {
    const photo = toPhoto({
      public_id: 'gallery/paris-01',
      width: 1600,
      height: 1067,
      format: 'jpg',
      created_at: '2026-01-02T03:04:05Z',
      tags: ['editorial', 'travel'],
      context: { custom: { title: 'Paris', client: 'Atlas', year: '2025', color: '#112233' } },
    })

    expect(photo.title).toBe('Paris')
    expect(photo.client).toBe('Atlas')
    expect(photo.year).toBe('2025')
    expect(photo.color).toBe('#112233')
    expect(photo.slug).toEqual(['gallery', 'paris-01'])
  })

  it('also reads context returned flat', () => {
    // The Admin API nests under `custom`; some endpoints return it flat.
    // Dropping either shape would silently lose every title.
    const photo = toPhoto({ public_id: 'gallery/x', context: { title: 'Flat' } })
    expect(photo.title).toBe('Flat')
  })

  it('falls back to a readable title derived from the public id', () => {
    const photo = toPhoto({ public_id: 'gallery/second_light-01' })
    expect(photo.title).toBe('Second Light 01')
  })

  it('falls back to the upload year when none is set', () => {
    const photo = toPhoto({ public_id: 'gallery/x', created_at: '2024-06-01T00:00:00Z' })
    expect(photo.year).toBe('2024')
  })

  it('rejects a colour that is not #rrggbb', () => {
    // The value is interpolated straight into a style attribute.
    for (const color of ['red', 'javascript:alert(1)', '#12', '']) {
      expect(toPhoto({ public_id: 'g/x', context: { color } }).color).toBe('#e7e5e2')
    }
  })

  it('uses the title as alt text when none is given', () => {
    const photo = toPhoto({ public_id: 'gallery/x', context: { title: 'Paris' } })
    expect(photo.alt).toBe('Paris')
  })
})

describe('media kind', () => {
  it('defaults to image', () => {
    expect(toPhoto({ public_id: 'gallery/x' }).kind).toBe('image')
  })

  it('carries video kind and duration through', () => {
    const video = toPhoto(
      { public_id: 'gallery/clip', duration: 12.4, format: 'mov' },
      'video',
    )
    expect(video.kind).toBe('video')
    expect(video.duration).toBeCloseTo(12.4)
  })

  it('does not put a duration on stills', () => {
    // The field is optional on purpose; an image with duration 0 would be a lie.
    expect(toPhoto({ public_id: 'gallery/x', duration: 5 }, 'image').duration).toBeUndefined()
  })

  it('defaults the format per kind', () => {
    expect(toPhoto({ public_id: 'g/a' }, 'image').format).toBe('jpg')
    expect(toPhoto({ public_id: 'g/b' }, 'video').format).toBe('mp4')
  })
})

describe('categoriesOf', () => {
  it('counts tags and orders by frequency then name', () => {
    const photos = [
      toPhoto({ public_id: 'g/a', tags: ['portrait'] }),
      toPhoto({ public_id: 'g/b', tags: ['landscape'] }),
      toPhoto({ public_id: 'g/c', tags: ['landscape'] }),
    ]
    expect(categoriesOf(photos)).toEqual([
      { name: 'landscape', count: 2 },
      { name: 'portrait', count: 1 },
    ])
  })

  it('buckets untagged photos rather than dropping them', () => {
    const photos = [toPhoto({ public_id: 'g/a' })]
    expect(categoriesOf(photos)).toEqual([{ name: 'uncategorised', count: 1 }])
  })
})
