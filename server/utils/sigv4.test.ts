import { describe, expect, it } from 'vitest'
import { amzDate, presignUrl, signHeaders, uriEncode } from './sigv4'

/**
 * R2 validates these signatures, and a drift fails every upload with an opaque
 * 403. So both modes are checked against the worked examples published in
 * AWS's S3 SigV4 documentation - an independent source, not this code's own
 * output.
 */
const EXAMPLE = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  service: 's3',
}
const EXAMPLE_DATE = new Date('2013-05-24T00:00:00Z')

describe('presignUrl', () => {
  it('matches the AWS query-string authentication example', () => {
    const url = presignUrl(EXAMPLE, {
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      expiresIn: 86400,
      date: EXAMPLE_DATE,
    })

    expect(url).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z' +
        '&X-Amz-Expires=86400' +
        '&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    )
  })

  it('changes when the path, a query value or a signed header changes', () => {
    const base = {
      method: 'PUT',
      host: 'acct.r2.cloudflarestorage.com',
      path: '/bucket/videos/a.mov',
      query: { partNumber: '1', uploadId: 'abc' },
      expiresIn: 3600,
      date: EXAMPLE_DATE,
    }
    const signature = (url: string) => new URL(url).searchParams.get('X-Amz-Signature')
    const original = signature(presignUrl(EXAMPLE, base))

    expect(signature(presignUrl(EXAMPLE, { ...base, path: '/bucket/videos/b.mov' }))).not.toBe(original)
    expect(signature(presignUrl(EXAMPLE, { ...base, query: { ...base.query, partNumber: '2' } }))).not.toBe(original)
    expect(
      signature(presignUrl(EXAMPLE, { ...base, headers: { 'Content-Type': 'image/jpeg' } })),
    ).not.toBe(original)
  })
})

describe('signHeaders', () => {
  it('matches the AWS Authorization-header GET example', () => {
    const { url, headers } = signHeaders(EXAMPLE, {
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      headers: { Range: 'bytes=0-9' },
      date: EXAMPLE_DATE,
    })

    expect(url).toBe('https://examplebucket.s3.amazonaws.com/test.txt')
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    )
    expect(headers['x-amz-content-sha256']).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    // fetch derives Host from the URL and refuses to have it set by hand.
    expect(headers.host).toBeUndefined()
  })

  it('hashes the body it is given', () => {
    const request = { method: 'POST', host: 'h', path: '/b/k', date: EXAMPLE_DATE }
    const empty = signHeaders(EXAMPLE, request).headers
    const withBody = signHeaders(EXAMPLE, { ...request, body: '<x/>' }).headers
    expect(withBody['x-amz-content-sha256']).not.toBe(empty['x-amz-content-sha256'])
    expect(withBody.authorization).not.toBe(empty.authorization)
  })

  it('keeps an empty-valued query parameter, as ?uploads needs', () => {
    const { url } = signHeaders(EXAMPLE, {
      method: 'POST',
      host: 'h',
      path: '/b/k',
      query: { uploads: '' },
      date: EXAMPLE_DATE,
    })
    expect(url).toBe('https://h/b/k?uploads=')
  })
})

describe('uriEncode', () => {
  it('encodes everything outside the unreserved set', () => {
    expect(uriEncode("a b!'()*+=&")).toBe('a%20b%21%27%28%29%2A%2B%3D%26')
    expect(uriEncode('-_.~AZaz09')).toBe('-_.~AZaz09')
  })

  it('keeps slashes only when asked', () => {
    expect(uriEncode('/bucket/a b', false)).toBe('/bucket/a%20b')
    expect(uriEncode('a/b')).toBe('a%2Fb')
  })
})

describe('amzDate', () => {
  it('formats as basic ISO 8601 without milliseconds', () => {
    expect(amzDate(new Date('2026-09-14T05:06:07.890Z'))).toBe('20260914T050607Z')
  })
})
