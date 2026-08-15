import { createHash } from 'node:crypto'

/**
 * Cloudinary is the only datastore for the gallery: the images live there, and
 * so does their metadata (title/client/year in `context`, category in `tags`).
 * There is no database to keep in sync.
 */

export type Photo = {
  publicId: string
  /** Path segments used to build `/gallery/...` URLs. */
  slug: string[]
  width: number
  height: number
  format: string
  createdAt: string
  title: string
  client: string
  year: string
  tags: string[]
  alt: string
  /** Dominant colour, painted before the image loads. */
  color: string
}

export type Category = { name: string; count: number }

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
}

export function cloudinaryConfig(): CloudinaryConfig {
  const config = useRuntimeConfig()

  /*
   * Coerced rather than cast: Nuxt parses env values with `destr`, and a
   * Cloudinary API key is all digits, so it would otherwise arrive as a number
   * and corrupt both the Basic auth header and the signed upload form.
   */
  const cloudName = String(config.public.cloudinaryCloudName ?? '')
  const apiKey = String(config.cloudinaryApiKey ?? '')
  const apiSecret = String(config.cloudinaryApiSecret ?? '')

  const missing = [
    !cloudName && 'NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
    !apiKey && 'NUXT_CLOUDINARY_API_KEY',
    !apiSecret && 'NUXT_CLOUDINARY_API_SECRET',
  ].filter(Boolean)

  if (missing.length) {
    throw new ConfigError(`Cloudinary is not configured. Missing: ${missing.join(', ')}`)
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: String(config.cloudinaryFolder ?? '') || 'gallery',
  }
}

export function isCloudinaryConfigured(): boolean {
  try {
    cloudinaryConfig()
    return true
  } catch {
    return false
  }
}

/**
 * Cloudinary's signature: take every signed parameter, sort by key, join as
 * `k=v&k=v`, append the API secret, SHA-1 the result.
 *
 * Implemented directly rather than pulling in the `cloudinary` SDK, which is a
 * large dependency to load into a serverless function for one hash. The
 * algorithm is pinned by a unit test that checks a known vector.
 */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(toSign + apiSecret).digest('hex')
}

type RawResource = {
  public_id: string
  format?: string
  width?: number
  height?: number
  created_at?: string
  tags?: string[]
  context?: Record<string, unknown> & { custom?: Record<string, string> }
}

function readContext(resource: RawResource): Record<string, string> {
  const ctx = resource.context
  if (!ctx) return {}
  const custom = ctx.custom
  if (custom && typeof custom === 'object') return custom
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value === 'string') flat[key] = value
  }
  return flat
}

/** Turn `gallery/paris-01` into a readable title as a last resort. */
function titleFromPublicId(publicId: string): string {
  const last = publicId.split('/').pop() ?? publicId
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function toPhoto(resource: RawResource): Photo {
  const context = readContext(resource)
  const tags = resource.tags ?? []
  const title = context.title?.trim() || titleFromPublicId(resource.public_id)

  return {
    publicId: resource.public_id,
    slug: resource.public_id.split('/'),
    width: resource.width ?? 1600,
    height: resource.height ?? 1067,
    format: resource.format ?? 'jpg',
    createdAt: resource.created_at ?? new Date(0).toISOString(),
    title,
    client: context.client?.trim() ?? '',
    year:
      context.year?.trim() ||
      (resource.created_at ? new Date(resource.created_at).getFullYear().toString() : ''),
    tags,
    alt: context.alt?.trim() || title,
    color: /^#[0-9a-f]{6}$/i.test(context.color ?? '') ? context.color : '#e7e5e2',
  }
}

/*
 * Cloudinary's Admin API is rate limited (500 requests/hour on the free tier),
 * so the listing is cached in memory rather than re-fetched per page view.
 * The cache is per instance; `invalidatePhotos` clears the one that just
 * handled an upload so the admin sees their own change immediately.
 */
const CACHE_TTL_MS = 5 * 60 * 1000
let cache: { photos: Photo[]; at: number } | null = null

export function invalidatePhotos() {
  cache = null
}

export async function listPhotos(): Promise<Photo[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.photos

  const { cloudName, apiKey, apiSecret, folder } = cloudinaryConfig()
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

  const resources: RawResource[] = []
  let cursor: string | undefined

  // Four pages of 500 is a safety valve, not an expected ceiling.
  for (let page = 0; page < 4; page += 1) {
    const query = new URLSearchParams({
      prefix: `${folder}/`,
      max_results: '500',
      context: 'true',
      tags: 'true',
    })
    if (cursor) query.set('next_cursor', cursor)

    const data = await $fetch<{ resources?: RawResource[]; next_cursor?: string }>(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?${query}`,
      { headers: { Authorization: `Basic ${auth}` } },
    )

    resources.push(...(data.resources ?? []))
    cursor = data.next_cursor
    if (!cursor) break
  }

  const photos = resources
    .map(toPhoto)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  cache = { photos, at: Date.now() }
  return photos
}

export function categoriesOf(photos: Photo[]): Category[] {
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

export type UploadTicket = {
  apiKey: string
  signature: string
  uploadUrl: string
  /** Echoed back so the client sends exactly what was signed. */
  params: Record<string, string>
}

/**
 * Mint a one-shot signed upload ticket.
 *
 * The browser uploads straight to Cloudinary with this, so the bytes never pass
 * through a Netlify Function (which has a hard 6MB request body limit) and the
 * API secret stays on the server.
 *
 * Every signed parameter is decided here. The client cannot widen the folder,
 * change the resource type, or smuggle in an eager transformation, because
 * altering anything signed invalidates the signature.
 */
export function createUploadTicket(
  context: Record<string, string>,
  tags: string[],
): UploadTicket {
  const { cloudName, apiKey, apiSecret, folder } = cloudinaryConfig()

  const contextString = Object.entries(context)
    .filter(([, value]) => value !== '')
    // `|` separates pairs and `=` separates key from value, so neither may
    // appear inside a value.
    .map(([key, value]) => `${key}=${value.replace(/[|=]/g, ' ')}`)
    .join('|')

  const params: Record<string, string> = {
    folder,
    timestamp: String(Math.floor(Date.now() / 1000)),
  }
  if (contextString) params.context = contextString
  if (tags.length) params.tags = tags.join(',')

  return {
    apiKey,
    signature: signParams(params, apiSecret),
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    params,
  }
}

export async function deletePhoto(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret, folder } = cloudinaryConfig()

  // Never let a caller delete outside the folder this app owns.
  if (!publicId.startsWith(`${folder}/`)) {
    throw new Error('Refusing to delete an asset outside the gallery folder.')
  }

  const params: Record<string, string> = {
    invalidate: 'true',
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
  }

  const body = new URLSearchParams({
    ...params,
    api_key: apiKey,
    signature: signParams(params, apiSecret),
  })

  const result = await $fetch<{ result?: string }>(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body },
  )

  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary delete failed: ${result.result}`)
  }

  invalidatePhotos()
}
