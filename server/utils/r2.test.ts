import { describe, expect, it } from 'vitest'
import {
  MAX_PARTS,
  buildVideoKey,
  completeMultipartXml,
  encodeCapped,
  isVideoKey,
  metadataHeaders,
  parseListObjects,
  partSizeFor,
  posterKeyFor,
  toVaultItem,
  xmlValue,
} from './r2'

const MiB = 1024 * 1024
const NOW = new Date('2026-09-14T05:06:07Z')

describe('buildVideoKey', () => {
  it('builds a dated, unique, readable key', () => {
    expect(buildVideoKey('IMG_0048.MOV', NOW, '1a2b3c4d')).toBe(
      `videos/2026/09/${NOW.getTime().toString(36)}-1a2b3c4d-img-0048.mov`,
    )
  })

  it('strips accents and anything outside a-z0-9', () => {
    const key = buildVideoKey('Café  at  Night (final)!.mp4', NOW, '00000000')
    expect(key.endsWith('-cafe-at-night-final.mp4')).toBe(true)
  })

  it('falls back when nothing readable survives', () => {
    expect(buildVideoKey('日本.webm', NOW, '00000000').endsWith('-video.webm')).toBe(true)
  })

  it('refuses a type the vault does not store', () => {
    expect(() => buildVideoKey('notes.txt', NOW)).toThrow()
  })

  it('always produces a key the vault accepts back', () => {
    for (const name of ['a.mov', 'IMG_0048.MOV', 'x'.repeat(300) + '.mp4', '---.m4v', 'ü.webm']) {
      expect(isVideoKey(buildVideoKey(name, NOW, 'deadbeef'))).toBe(true)
    }
  })
})

describe('isVideoKey', () => {
  it('rejects anything outside the videos prefix', () => {
    const valid = buildVideoKey('a.mov', NOW, 'deadbeef')
    for (const key of [
      valid.replace('videos/', 'posters/'),
      `../${valid}`,
      `${valid}/../../secret`,
      'videos/2026/09/../../x.mov',
      valid.replace('.mov', '.jpg'),
      '',
      42,
      null,
    ]) {
      expect(isVideoKey(key)).toBe(false)
    }
  })
})

describe('posterKeyFor', () => {
  it('mirrors the video key under the poster prefix', () => {
    expect(posterKeyFor('videos/2026/09/abc-deadbeef-clip.mov')).toBe('posters/2026/09/abc-deadbeef-clip.jpg')
  })
})

describe('partSizeFor', () => {
  it('uses 10MB parts for anything a phone records', () => {
    expect(partSizeFor(1)).toBe(10 * MiB)
    expect(partSizeFor(4 * 1024 * MiB)).toBe(10 * MiB)
  })

  it('grows so no file needs more than the part limit', () => {
    for (const size of [200 * 1024 * MiB, 1024 * 1024 * MiB, 4.99 * 1024 * 1024 * MiB]) {
      const partSize = partSizeFor(size)
      expect(Math.ceil(size / partSize)).toBeLessThanOrEqual(MAX_PARTS)
      expect(partSize % MiB).toBe(0)
    }
  })
})

describe('encodeCapped', () => {
  it('leaves short values whole', () => {
    expect(encodeCapped('Sunset, Manila', 100)).toBe('Sunset%2C%20Manila')
  })

  it('never exceeds the budget and never splits a character', () => {
    const encoded = encodeCapped('😀'.repeat(50), 40)
    expect(encoded.length).toBeLessThanOrEqual(40)
    expect(() => decodeURIComponent(encoded)).not.toThrow()
    expect(decodeURIComponent(encoded)).toBe('😀'.repeat(3))
  })
})

describe('metadata round trip', () => {
  it('reads back what it wrote', () => {
    const headers = new Headers({
      ...metadataHeaders({
        title: 'Lola’s 80th — Cebu',
        client: 'Family',
        year: '2026',
        tags: ['family', 'birthday'],
        filename: 'IMG_0048.MOV',
        width: 3840,
        height: 2160,
        duration: 83.456,
        hasPoster: true,
      }),
      'content-type': 'video/quicktime',
    })

    const item = toVaultItem(
      { key: 'videos/2026/09/abc-deadbeef-img-0048.mov', size: 512 * MiB, lastModified: '2026-09-14T05:06:07.000Z' },
      headers,
    )

    expect(item).toEqual({
      key: 'videos/2026/09/abc-deadbeef-img-0048.mov',
      title: 'Lola’s 80th — Cebu',
      client: 'Family',
      year: '2026',
      tags: ['family', 'birthday'],
      filename: 'IMG_0048.MOV',
      contentType: 'video/quicktime',
      size: 512 * MiB,
      width: 3840,
      height: 2160,
      duration: 83.46,
      createdAt: '2026-09-14T05:06:07.000Z',
      hasPoster: true,
    })
  })

  it('keeps every header ASCII, as HTTP requires', () => {
    const headers = metadataHeaders({
      title: '日本の夏 ☀️',
      client: 'Ñandú',
      year: '2026',
      tags: [],
      filename: 'été.mov',
      width: 0,
      height: 0,
      hasPoster: false,
    })
    for (const value of Object.values(headers)) expect(value).toMatch(/^[\x20-\x7e]*$/)
  })

  it('fills sensible defaults for an object with no metadata', () => {
    const item = toVaultItem(
      { key: 'videos/2026/09/abc-deadbeef-img-0048.mov', size: 1, lastModified: '2025-01-01T00:00:00.000Z' },
      new Headers(),
    )
    expect(item.title).toBe('Img 0048')
    expect(item.year).toBe('2025')
    expect(item.tags).toEqual([])
    expect(item.duration).toBeUndefined()
    expect(item.hasPoster).toBe(false)
    expect(item.contentType).toBe('video/quicktime')
  })
})

describe('parseListObjects', () => {
  it('reads keys, sizes, dates and the continuation token', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <Contents><Key>videos/2026/09/a-deadbeef-r&amp;d.mov</Key><Size>123</Size><LastModified>2026-09-14T05:06:07.000Z</LastModified></Contents>
  <Contents><Key>videos/2026/09/b-deadbeef-x.mp4</Key><Size>456</Size><LastModified>2026-09-13T00:00:00.000Z</LastModified></Contents>
  <NextContinuationToken>tok&lt;1&gt;</NextContinuationToken>
</ListBucketResult>`

    expect(parseListObjects(xml)).toEqual({
      objects: [
        { key: 'videos/2026/09/a-deadbeef-r&d.mov', size: 123, lastModified: '2026-09-14T05:06:07.000Z' },
        { key: 'videos/2026/09/b-deadbeef-x.mp4', size: 456, lastModified: '2026-09-13T00:00:00.000Z' },
      ],
      nextToken: 'tok<1>',
    })
  })

  it('stops when the listing is not truncated', () => {
    const xml = '<ListBucketResult><IsTruncated>false</IsTruncated><NextContinuationToken>x</NextContinuationToken></ListBucketResult>'
    expect(parseListObjects(xml)).toEqual({ objects: [] })
  })
})

describe('xml helpers', () => {
  it('reads an error code and numeric entities', () => {
    const xml = '<Error><Code>AccessDenied</Code><Message>No &#39;access&#x27;</Message></Error>'
    expect(xmlValue(xml, 'Code')).toBe('AccessDenied')
    expect(xmlValue(xml, 'Message')).toBe("No 'access'")
    expect(xmlValue(xml, 'Missing')).toBeUndefined()
  })

  it('quotes part ETags exactly once', () => {
    expect(completeMultipartXml([{ partNumber: 1, etag: 'abc' }, { partNumber: 2, etag: '"def"' }])).toBe(
      '<CompleteMultipartUpload>' +
        '<Part><PartNumber>1</PartNumber><ETag>"abc"</ETag></Part>' +
        '<Part><PartNumber>2</PartNumber><ETag>"def"</ETag></Part>' +
        '</CompleteMultipartUpload>',
    )
  })
})
