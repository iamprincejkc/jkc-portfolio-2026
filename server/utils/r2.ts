import { randomBytes } from 'node:crypto'
import { ConfigError } from './cloudinary'
import { presignUrl, signHeaders, type SigningCredentials } from './sigv4'

/**
 * The private video vault, on Cloudflare R2.
 *
 * Cloudinary's free tier refuses video over 100MB, and a minute of 4K from a
 * phone is several times that. Video is also not shown in the gallery - it is
 * kept, not published - so it has no use for Cloudinary's transformations.
 * R2 stores the original file byte for byte, with no size cap worth the name.
 *
 * The browser uploads straight to R2 in parts, each through a URL presigned
 * here, for the same reason the Cloudinary upload is direct: a Netlify Function
 * request body is capped at 6MB. The keys stay on the server, and they are
 * scoped to the one bucket.
 *
 * There is no database. Title, client, year and categories ride on the object
 * itself as custom metadata, so an object and its description can never drift
 * apart, and deleting one deletes both.
 */

export type VaultItem = {
  key: string
  title: string
  client: string
  year: string
  tags: string[]
  /** The name the file had on the device it came from. */
  filename: string
  contentType: string
  size: number
  /** 0 when the uploading browser could not decode the video to measure it. */
  width: number
  height: number
  /** Seconds. */
  duration?: number
  createdAt: string
  hasPoster: boolean
}

export type SignedVaultItem = VaultItem & {
  playUrl: string
  downloadUrl: string
  /** Empty when no poster frame was captured. */
  posterUrl: string
}

export type VaultPayload = { configured: boolean; items: SignedVaultItem[] }

type R2Config = SigningCredentials & { host: string; bucket: string }

export function r2Config(): R2Config {
  const config = useRuntimeConfig()

  // Coerced for the same reason as the Cloudinary keys: `destr` would turn an
  // all-digit value into a number.
  const accountId = String(config.r2AccountId ?? '')
  const accessKeyId = String(config.r2AccessKeyId ?? '')
  const secretAccessKey = String(config.r2SecretAccessKey ?? '')
  const bucket = String(config.r2Bucket ?? '')

  const missing = [
    !accountId && 'NUXT_R2_ACCOUNT_ID',
    !accessKeyId && 'NUXT_R2_ACCESS_KEY_ID',
    !secretAccessKey && 'NUXT_R2_SECRET_ACCESS_KEY',
    !bucket && 'NUXT_R2_BUCKET',
  ].filter(Boolean)

  if (missing.length) {
    throw new ConfigError(`R2 is not configured. Missing: ${missing.join(', ')}`)
  }

  return {
    accessKeyId,
    secretAccessKey,
    // R2 ignores the region, but SigV4 needs one; `auto` is what it documents.
    region: 'auto',
    service: 's3',
    host: `${accountId}.r2.cloudflarestorage.com`,
    bucket,
  }
}

export function isR2Configured(): boolean {
  try {
    r2Config()
    return true
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Keys                                                                        */
/* -------------------------------------------------------------------------- */

export const VIDEO_PREFIX = 'videos/'
export const POSTER_PREFIX = 'posters/'

export const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

/**
 * Every key the vault will act on. Strict on purpose: delete and complete take
 * a key from the browser, and this is what stops one reaching a poster, another
 * prefix, or anything outside the vault.
 */
const VIDEO_KEY = /^videos\/\d{4}\/\d{2}\/[a-z0-9]+-[a-f0-9]{8}-[a-z0-9-]{1,60}\.(mp4|m4v|mov|webm)$/

export function isVideoKey(key: unknown): key is string {
  return typeof key === 'string' && VIDEO_KEY.test(key)
}

export function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

/** `videos/2026/09/mf2k3x-1a2b3c4d-img-0048.mov` - sortable, unique, readable. */
export function buildVideoKey(
  filename: string,
  now = new Date(),
  random = randomBytes(4).toString('hex'),
): string {
  const extension = extensionOf(filename)
  if (!VIDEO_TYPES[extension]) throw new Error(`Unsupported video type: .${extension}`)

  const base =
    filename
      .replace(/\.[^.]+$/, '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'video'

  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${VIDEO_PREFIX}${year}/${month}/${now.getTime().toString(36)}-${random}-${base}.${extension}`
}

export function posterKeyFor(videoKey: string): string {
  return `${POSTER_PREFIX}${videoKey.slice(VIDEO_PREFIX.length).replace(/\.[^.]+$/, '')}.jpg`
}

/* -------------------------------------------------------------------------- */
/* Multipart sizing                                                            */
/* -------------------------------------------------------------------------- */

const MiB = 1024 * 1024

/** S3's ceiling on parts per upload, which R2 shares. */
export const MAX_PARTS = 10_000

/** R2's largest object, rounded down. */
export const MAX_OBJECT_BYTES = Math.floor(4.99 * 1024 * 1024 * MiB)

/**
 * Small enough that a dropped mobile connection only re-sends a few seconds of
 * work, large enough that a 4GB clip stays in the hundreds of requests. Grows
 * only when a file would otherwise need more than MAX_PARTS.
 *
 * Every part but the last must be the same size - R2 rejects the upload
 * otherwise - so this is decided once, here, and the browser follows it.
 */
export function partSizeFor(size: number): number {
  return Math.max(10 * MiB, Math.ceil(size / MAX_PARTS / MiB) * MiB)
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

export type VaultMetadata = {
  title: string
  client: string
  year: string
  tags: string[]
  filename: string
  width: number
  height: number
  duration?: number
  hasPoster: boolean
}

/**
 * Percent-encode, trimmed to a byte budget without splitting a character.
 *
 * Metadata travels as HTTP headers, which must be ASCII, and S3-compatible
 * stores cap the whole set at 2KB. A title in another script can triple in
 * size once encoded, so the budget applies to the encoded form.
 */
export function encodeCapped(value: string, maxBytes: number): string {
  const chars = Array.from(value)
  let encoded = encodeURIComponent(value)
  while (encoded.length > maxBytes && chars.length) {
    chars.pop()
    encoded = encodeURIComponent(chars.join(''))
  }
  return encoded
}

function safeDecode(value: string | null): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function metadataHeaders(meta: VaultMetadata): Record<string, string> {
  const headers: Record<string, string> = {
    'x-amz-meta-title': encodeCapped(meta.title, 600),
    'x-amz-meta-client': encodeCapped(meta.client, 400),
    'x-amz-meta-year': encodeCapped(meta.year, 4),
    'x-amz-meta-tags': encodeCapped(meta.tags.join(','), 400),
    'x-amz-meta-filename': encodeCapped(meta.filename, 400),
    'x-amz-meta-width': String(Math.round(meta.width) || 0),
    'x-amz-meta-height': String(Math.round(meta.height) || 0),
    'x-amz-meta-poster': meta.hasPoster ? '1' : '0',
  }
  if (meta.duration !== undefined) headers['x-amz-meta-duration'] = meta.duration.toFixed(2)
  return headers
}

/** Turn `videos/2026/09/mf2k3x-1a2b3c4d-img-0048.mov` into `Img 0048`. */
function titleFromKey(key: string): string {
  const name = key.split('/').pop() ?? key
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^[a-z0-9]+-[a-f0-9]{8}-/, '')
    .replace(/-+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function toVaultItem(
  object: { key: string; size: number; lastModified: string },
  headers: Headers,
): VaultItem {
  const meta = (name: string) => safeDecode(headers.get(`x-amz-meta-${name}`))
  const number = (name: string) => {
    const value = Number(meta(name))
    return Number.isFinite(value) && value > 0 ? value : 0
  }
  const duration = number('duration')

  return {
    key: object.key,
    title: meta('title').trim() || titleFromKey(object.key),
    client: meta('client').trim(),
    year:
      meta('year').trim() ||
      (object.lastModified ? new Date(object.lastModified).getFullYear().toString() : ''),
    tags: meta('tags').split(',').map((tag) => tag.trim()).filter(Boolean),
    filename: meta('filename') || (object.key.split('/').pop() ?? ''),
    contentType: headers.get('content-type') || VIDEO_TYPES[extensionOf(object.key)] || '',
    size: object.size,
    width: number('width'),
    height: number('height'),
    ...(duration ? { duration } : {}),
    createdAt: object.lastModified,
    hasPoster: meta('poster') === '1',
  }
}

/* -------------------------------------------------------------------------- */
/* XML                                                                         */
/* -------------------------------------------------------------------------- */

/*
 * S3 answers in XML. The handful of fields read here do not justify a parser
 * dependency; they are flat, and their values are entity-escaped text.
 */

function decodeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, entity: string) => {
    switch (entity.toLowerCase()) {
      case 'amp': return '&'
      case 'lt': return '<'
      case 'gt': return '>'
      case 'quot': return '"'
      case 'apos': return "'"
    }
    const code = entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16)
      : parseInt(entity.slice(1), 10)
    return String.fromCodePoint(code)
  })
}

export function xmlValue(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  return match ? decodeXml(match[1]) : undefined
}

export function parseListObjects(xml: string): {
  objects: { key: string; size: number; lastModified: string }[]
  nextToken?: string
} {
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, block]) => ({
    key: xmlValue(block, 'Key') ?? '',
    size: Number(xmlValue(block, 'Size') ?? 0),
    lastModified: xmlValue(block, 'LastModified') ?? '',
  }))

  const truncated = xmlValue(xml, 'IsTruncated') === 'true'
  return {
    objects: objects.filter((object) => object.key),
    ...(truncated ? { nextToken: xmlValue(xml, 'NextContinuationToken') } : {}),
  }
}

export function completeMultipartXml(parts: { partNumber: number; etag: string }[]): string {
  const body = parts
    .map(({ partNumber, etag }) => {
      const quoted = etag.startsWith('"') ? etag : `"${etag}"`
      return `<Part><PartNumber>${partNumber}</PartNumber><ETag>${quoted}</ETag></Part>`
    })
    .join('')
  return `<CompleteMultipartUpload>${body}</CompleteMultipartUpload>`
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

class R2Error extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'R2Error'
  }
}

/** Upload ids are opaque, but always URL-safe text of bounded length. */
export function isUploadId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9+/=._~-]{1,1024}$/.test(value)
}

/** Map a vault failure onto an HTTP error the uploader can show as-is. */
export function vaultHttpError(error: unknown): Error {
  if (error instanceof ConfigError) {
    return createError({ statusCode: 503, statusMessage: error.message })
  }
  if (error instanceof R2Error) {
    return createError({ statusCode: 502, statusMessage: error.message })
  }
  return createError({
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : 'R2 request failed.',
  })
}

async function r2Request(
  method: string,
  key: string,
  options: { query?: Record<string, string>; headers?: Record<string, string>; body?: string } = {},
): Promise<Response> {
  const config = r2Config()
  const { url, headers } = signHeaders(config, {
    method,
    host: config.host,
    path: key ? `/${config.bucket}/${key}` : `/${config.bucket}`,
    query: options.query,
    headers: options.headers,
    body: options.body,
  })

  // R2 refuses the TLS handshake for an account id that does not exist, which
  // fetch reports only as "fetch failed" - useless when diagnosing a typo.
  const response = await fetch(url, { method, headers, body: options.body }).catch(() => {
    throw new R2Error('Could not connect to R2. Check NUXT_R2_ACCOUNT_ID.', 0)
  })

  if (!response.ok) {
    const text = method === 'HEAD' ? '' : await response.text().catch(() => '')
    const code = xmlValue(text, 'Code')
    const message = xmlValue(text, 'Message')
    throw new R2Error(
      `R2 ${method} failed (${response.status}${code ? ` ${code}` : ''})${message ? `: ${message}` : ''}`,
      response.status,
    )
  }

  return response
}

function presign(
  method: string,
  key: string,
  expiresIn: number,
  options: { query?: Record<string, string>; headers?: Record<string, string>; date?: Date } = {},
): string {
  const config = r2Config()
  return presignUrl(config, {
    method,
    host: config.host,
    path: `/${config.bucket}/${key}`,
    expiresIn,
    ...options,
  })
}

/** Presigned part URLs outlive a slow part on a poor connection, and little else. */
const PART_URL_TTL = 60 * 60

export async function createVaultUpload(input: {
  filename: string
  size: number
  contentType: string
  meta: VaultMetadata
}): Promise<{
  key: string
  uploadId: string
  partSize: number
  partCount: number
  posterUploadUrl: string
}> {
  const key = buildVideoKey(input.filename)
  const response = await r2Request('POST', key, {
    query: { uploads: '' },
    headers: { 'content-type': input.contentType, ...metadataHeaders(input.meta) },
  })

  const uploadId = xmlValue(await response.text(), 'UploadId')
  if (!uploadId) throw new Error('R2 did not return an upload id.')

  const partSize = partSizeFor(input.size)

  return {
    key,
    uploadId,
    partSize,
    partCount: Math.max(1, Math.ceil(input.size / partSize)),
    // Content type is signed, so the poster is served as an image and cannot
    // be swapped for something else under the same URL.
    posterUploadUrl: input.meta.hasPoster
      ? presign('PUT', posterKeyFor(key), PART_URL_TTL, { headers: { 'content-type': 'image/jpeg' } })
      : '',
  }
}

export function signPartUrls(
  key: string,
  uploadId: string,
  partNumbers: number[],
): { partNumber: number; url: string }[] {
  return partNumbers.map((partNumber) => ({
    partNumber,
    url: presign('PUT', key, PART_URL_TTL, {
      query: { partNumber: String(partNumber), uploadId },
    }),
  }))
}

export async function completeVaultUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber)
  await r2Request('POST', key, {
    query: { uploadId },
    headers: { 'content-type': 'application/xml' },
    body: completeMultipartXml(sorted),
  })
  invalidateVault()
}

export async function abortVaultUpload(key: string, uploadId: string): Promise<void> {
  await r2Request('DELETE', key, { query: { uploadId } })
  // A poster may already have landed for the upload that is being abandoned.
  await r2Request('DELETE', posterKeyFor(key)).catch(() => undefined)
}

export async function deleteVaultItem(key: string): Promise<void> {
  // S3 answers 204 whether or not the object existed, so neither call needs a
  // not-found branch.
  await r2Request('DELETE', key)
  await r2Request('DELETE', posterKeyFor(key))
  invalidateVault()
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

/*
 * Listing does not return custom metadata, so each object costs a HEAD. The
 * result is cached per instance like the Cloudinary listing, and invalidated by
 * the instance that handles an upload or delete.
 */
const CACHE_TTL_MS = 5 * 60 * 1000
const HEAD_CONCURRENCY = 8
let cache: { items: VaultItem[]; at: number } | null = null

export function invalidateVault() {
  cache = null
}

export async function listVault(): Promise<VaultItem[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items

  const objects: { key: string; size: number; lastModified: string }[] = []
  let token: string | undefined

  // Twenty pages of a thousand is a safety valve, not an expected ceiling.
  for (let page = 0; page < 20; page += 1) {
    const query: Record<string, string> = { 'list-type': '2', prefix: VIDEO_PREFIX }
    if (token) query['continuation-token'] = token
    const listing = parseListObjects(await (await r2Request('GET', '', { query })).text())
    objects.push(...listing.objects)
    token = listing.nextToken
    if (!token) break
  }

  const items: VaultItem[] = []
  const queue = objects.filter((object) => isVideoKey(object.key))

  async function worker() {
    for (let object = queue.shift(); object; object = queue.shift()) {
      const response = await r2Request('HEAD', object.key)
      items.push(toVaultItem(object, response.headers))
    }
  }
  await Promise.all(Array.from({ length: HEAD_CONCURRENCY }, worker))

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  cache = { items, at: Date.now() }
  return items
}

/** Playback and download links last at least five hours from when they are issued. */
const VIEW_URL_TTL = 6 * 60 * 60

/** `filename*` carries the real name; `filename` is the ASCII fallback. */
function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

/**
 * Viewing links, signed per request.
 *
 * The signing time is rounded down to the hour, so the same object keeps the
 * same URL for an hour at a time. Otherwise every page load would mint new
 * URLs and the browser could never reuse a cached poster.
 */
export function signVaultItem(item: VaultItem, now = new Date()): SignedVaultItem {
  const date = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000)

  return {
    ...item,
    playUrl: presign('GET', item.key, VIEW_URL_TTL, { date }),
    downloadUrl: presign('GET', item.key, VIEW_URL_TTL, {
      date,
      query: { 'response-content-disposition': attachmentDisposition(item.filename) },
    }),
    posterUrl: item.hasPoster ? presign('GET', posterKeyFor(item.key), VIEW_URL_TTL, { date }) : '',
  }
}
