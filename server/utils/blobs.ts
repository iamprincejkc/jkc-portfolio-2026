import { createStorage, type Storage } from 'unstorage'
import netlifyBlobs from 'unstorage/drivers/netlify-blobs'

/**
 * A Netlify Blobs store for the current request.
 *
 * Never a Nitro storage mount in production. unstorage's netlify-blobs driver calls `getStore()` once and keeps
 * the client for the life of the function instance, and that client carries the Blobs access token from the
 * request that created it. The token expires after roughly 15-30 minutes, so a warm instance then fails every
 * request with "BlobsInternalError: Failed to decode token: Token expired" until Netlify recycles it - which
 * is how the Shiftbell relay broke half an hour after each deploy (2026-10-31) while a fresh deploy preview
 * worked. A new client per request reads the context of that request. It is only an object; nothing connects.
 *
 * Development keeps the `devStorage` folder mounts in nuxt.config.ts.
 */
export function requestBlobs(mount: 'evently' | 'shiftbell', name: string): Storage {
  if (import.meta.dev) return useStorage(mount)
  return createStorage({ driver: netlifyBlobs({ name, consistency: 'strong' }) })
}
