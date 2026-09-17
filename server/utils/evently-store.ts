import type { H3Event } from 'h3'
import { PHOTO_NAME, WORLD_ID, bearerToken, keys, sizeProblem, tokenMatches, type WorldMeta } from './evently'

/**
 * The storage half of Evently's shared worlds. The rules live in `evently.ts`;
 * this is where they meet the request and the store.
 *
 * The `evently` mount is Netlify Blobs in production and a folder under
 * `.data/` in development - see `nitro.storage` in nuxt.config.ts.
 */

export function eventlyStore() {
  return useStorage('evently')
}

/**
 * Nothing Evently returns may sit in a shared cache. The bytes are encrypted,
 * but the edit responses carry tokens and versions, and a shared cache holding
 * one version of a world hides the next.
 */
export function noStore(event: H3Event) {
  setResponseHeader(event, 'cache-control', 'no-store')
}

export function worldIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!WORLD_ID.test(id)) throw createError({ statusCode: 404, statusMessage: 'No such world.' })
  return id
}

export function photoNameParam(event: H3Event): string {
  const name = getRouterParam(event, 'name') ?? ''
  if (!PHOTO_NAME.test(name)) throw createError({ statusCode: 404, statusMessage: 'No such photo.' })
  return name
}

export async function readMeta(id: string): Promise<WorldMeta | null> {
  const meta = await eventlyStore().getItem<WorldMeta>(keys.meta(id))
  return meta && typeof meta === 'object' && meta.v === 1 ? meta : null
}

/** Loads the world and proves the caller holds its edit token. */
export async function requireEditor(event: H3Event, id: string): Promise<WorldMeta> {
  const meta = await readMeta(id)
  if (!meta) throw createError({ statusCode: 404, statusMessage: 'No such world.' })

  const token = bearerToken(getRequestHeader(event, 'authorization'))
  if (!tokenMatches(token, meta.tokenHash)) {
    throw createError({ statusCode: 403, statusMessage: 'This link does not allow editing.' })
  }
  return meta
}

/** Reads an opaque body, refusing it before and after reading if it is too big. */
export async function readOpaqueBody(event: H3Event, limit: number): Promise<Buffer> {
  const declared = getRequestHeader(event, 'content-length')
  const early = sizeProblem(declared, null, limit)
  if (early) {
    // Refused without reading the body, so the socket still holds it. Without
    // this a keep-alive client sends its next request down the same socket and
    // gets a connection reset instead of an answer - measured in development.
    setResponseHeader(event, 'connection', 'close')
    throw createError({ statusCode: 413, statusMessage: early })
  }

  const body = (await readRawBody(event, false)) ?? Buffer.alloc(0)
  const problem = sizeProblem(declared, body.byteLength, limit)
  if (problem) throw createError({ statusCode: body.byteLength ? 413 : 400, statusMessage: problem })
  return Buffer.from(body)
}

export async function photoCount(id: string): Promise<number> {
  return (await eventlyStore().getKeys(keys.photos(id))).length
}

export function sendOpaque(event: H3Event, bytes: ArrayBuffer | Uint8Array) {
  setResponseHeader(event, 'content-type', 'application/octet-stream')
  // Opaque bytes are never a document. Belt and braces with nosniff.
  setResponseHeader(event, 'content-disposition', 'attachment')
  return Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes)
}
