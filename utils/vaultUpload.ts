/**
 * Uploads an original video to the R2 vault, straight from the browser.
 *
 * The file is sent exactly as it was picked - no transcoding, no resizing -
 * in parts of the size the server decides. Each part goes to its own presigned
 * URL, so the R2 keys never reach the browser and nothing large crosses the
 * Netlify Function.
 *
 * Built for a phone, where the page is routinely interrupted:
 *
 * - iOS suspends a page within seconds of the screen locking or another app
 *   opening. Parts waiting to go wait for the page to be visible and online
 *   again, and a part that failed *because* of the interruption does not use
 *   up one of its retries.
 * - The multipart upload outlives a failure. Its id and every finished part's
 *   ETag live in a `VaultResume` the caller keeps, so retrying re-sends only
 *   the parts that never landed - at most a few 10MB pieces, not the clip.
 * - URLs are fetched in small batches as the upload advances, and re-fetched
 *   if a long pause has left them stale.
 *
 * What cannot survive is the tab itself closing: the file is gone with it. The
 * bucket's lifecycle rule clears the orphaned parts.
 */

export type VaultUploadMeta = {
  title: string
  client: string
  year: string
  tags: string[]
}

type Ticket = {
  key: string
  uploadId: string
  partSize: number
  partCount: number
  posterUploadUrl: string
}

type VaultSession = {
  key: string
  uploadId: string
  partSize: number
  partCount: number
  /** partNumber -> ETag, for every part R2 has confirmed. */
  parts: Map<number, string>
}

/**
 * Everything needed to pick an interrupted upload back up. Create one per
 * queued file and pass the same object to every attempt.
 */
export type VaultResume = {
  session?: VaultSession
  /** The attempt currently allowed to work; an older one stops on seeing it change. */
  run?: symbol
}

type Probe = {
  width: number
  height: number
  duration?: number
  poster: Blob | null
}

/** Parts in flight at once, per file. */
const PART_CONCURRENCY = 3
const SIGN_BATCH = 20
/** Failures a part may have while the page is visible and online. */
const MAX_ATTEMPTS = 5
const POSTER_WIDTH = 640
/** Part URLs are signed for an hour; past this they are fetched again. */
const URL_REUSE_MS = 45 * 60 * 1000
/** A visible page with no upload progress for this long has a dead request. */
const STALL_MS = 60 * 1000

/**
 * Size, duration and a poster frame, read by the browser's own decoder.
 *
 * Best-effort throughout. A desktop browser without HEVC support cannot
 * decode an iPhone clip at all; that costs the poster and the measurements,
 * never the upload.
 */
export function probeVideo(file: File, timeoutMs = 10_000): Promise<Probe> {
  const empty: Probe = { width: 0, height: 0, poster: null }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let settled = false
    // What is known so far, so a poster that never arrives keeps the measurements.
    let best = empty

    const finish = (result: Probe) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(result)
    }

    const timer = setTimeout(() => finish(best), timeoutMs)

    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    video.addEventListener('error', () => finish(empty), { once: true })

    video.addEventListener(
      'loadedmetadata',
      () => {
        const measured: Probe = {
          width: video.videoWidth,
          height: video.videoHeight,
          ...(Number.isFinite(video.duration) && video.duration > 0 ? { duration: video.duration } : {}),
          poster: null,
        }
        best = measured

        video.addEventListener(
          'seeked',
          () => {
            try {
              const scale = Math.min(1, POSTER_WIDTH / (video.videoWidth || POSTER_WIDTH))
              const canvas = document.createElement('canvas')
              canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
              canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
              canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
              canvas.toBlob((blob) => finish({ ...measured, poster: blob }), 'image/jpeg', 0.8)
            } catch {
              finish(measured)
            }
          },
          { once: true },
        )

        // A second in, not zero: the first frame of a phone clip is often black.
        video.currentTime = Math.min(1, (measured.duration ?? 0) / 2)
      },
      { once: true },
    )

    video.src = url
    video.load()
  })
}

/* -------------------------------------------------------------------------- */
/* Interruptions                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Bumped every time the page is hidden or the connection drops. A request that
 * fails with this number changed since it started was interrupted, not broken.
 */
let interruptions = 0
let watching = false

function watchInterruptions() {
  if (watching) return
  watching = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') interruptions += 1
  })
  window.addEventListener('offline', () => {
    interruptions += 1
  })
}

function canSend(): boolean {
  return document.visibilityState === 'visible' && navigator.onLine
}

function untilCanSend(): Promise<void> {
  if (canSend()) return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (!canSend()) return
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      resolve()
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
  })
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

class PartError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

/** One PUT, with upload progress. Resolves to the part's ETag. */
function putBlob(
  url: string,
  body: Blob,
  onProgress: (loaded: number) => void,
  contentType?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url, true)
    if (contentType) request.setRequestHeader('Content-Type', contentType)

    /*
     * A request suspended with the page does not always fail when the page
     * comes back - it can simply never finish. Time spent hidden does not
     * count, so only a request stalled in plain view is abandoned.
     */
    let lastActivity = Date.now()
    const onVisible = () => {
      if (document.visibilityState === 'visible') lastActivity = Date.now()
    }
    document.addEventListener('visibilitychange', onVisible)
    const watchdog = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity > STALL_MS) {
        request.abort()
      }
    }, 10_000)

    const settle = () => {
      clearInterval(watchdog)
      document.removeEventListener('visibilitychange', onVisible)
    }

    request.upload.addEventListener('progress', (event) => {
      lastActivity = Date.now()
      onProgress(event.loaded)
    })

    request.addEventListener('load', () => {
      settle()
      if (request.status < 200 || request.status >= 300) {
        reject(new PartError(`R2 answered ${request.status}.`, request.status))
        return
      }
      const etag = request.getResponseHeader('ETag')
      if (!etag) {
        // Only possible when the bucket's CORS policy does not expose ETag -
        // a setup mistake that should say so, not look like a network fault.
        reject(new PartError('R2 hid the ETag header. Add "ETag" to ExposeHeaders in the bucket CORS policy.', 0))
        return
      }
      resolve(etag)
    })

    const fail = () => {
      settle()
      reject(new PartError('Could not reach R2. Check the connection, or the bucket CORS policy.', 0))
    }
    request.addEventListener('error', fail)
    request.addEventListener('abort', fail)

    request.send(body)
  })
}

/** R2 no longer knows this multipart upload - aborted, or cleared by the lifecycle rule. */
function isGone(error: unknown): boolean {
  if (error instanceof PartError) return error.status === 404
  const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? ''
  return message.includes('NoSuchUpload')
}

/* -------------------------------------------------------------------------- */
/* Upload                                                                      */
/* -------------------------------------------------------------------------- */

export async function uploadToVault(
  file: File,
  meta: VaultUploadMeta,
  resume: VaultResume,
  callbacks: {
    onProgress: (fraction: number) => void
    /** True while the upload is held waiting for the page or the connection. */
    onWaiting?: (waiting: boolean) => void
  },
): Promise<void> {
  watchInterruptions()

  const run = Symbol('run')
  resume.run = run
  const superseded = () => resume.run !== run

  let waiters = 0
  async function ready() {
    if (canSend()) return
    waiters += 1
    callbacks.onWaiting?.(true)
    await untilCanSend()
    waiters -= 1
    if (waiters === 0) callbacks.onWaiting?.(false)
  }

  if (!resume.session) {
    const probe = await probeVideo(file)
    await ready()

    const ticket = await $fetch<Ticket>('/api/gallery/admin/vault/create', {
      method: 'POST',
      body: {
        ...meta,
        filename: file.name,
        size: file.size,
        width: probe.width,
        height: probe.height,
        duration: probe.duration,
        poster: Boolean(probe.poster),
      },
    })

    resume.session = {
      key: ticket.key,
      uploadId: ticket.uploadId,
      partSize: ticket.partSize,
      partCount: ticket.partCount,
      parts: new Map(),
    }

    if (ticket.posterUploadUrl && probe.poster) {
      // A missing poster is cosmetic; never fail the video over it.
      await putBlob(ticket.posterUploadUrl, probe.poster, () => undefined, 'image/jpeg').catch(
        () => undefined,
      )
    }
  }

  const session = resume.session

  const partBytes = (partNumber: number) =>
    Math.min(session.partSize, file.size - (partNumber - 1) * session.partSize)

  // Parts from an earlier attempt count from the start, so a resumed upload
  // shows where it really is instead of falling back to zero.
  const loaded = new Map<number, number>()
  for (const partNumber of session.parts.keys()) loaded.set(partNumber, partBytes(partNumber))
  const report = () => {
    let total = 0
    for (const bytes of loaded.values()) total += bytes
    callbacks.onProgress(Math.min(1, total / file.size))
  }
  report()

  const urls = new Map<number, { url: string; signedAt: number }>()
  let signing: Promise<void> | null = null

  /** A fresh URL for this part, signed together with the next few still to go. */
  async function urlFor(partNumber: number): Promise<string> {
    for (;;) {
      const cached = urls.get(partNumber)
      if (cached && Date.now() - cached.signedAt < URL_REUSE_MS) return cached.url

      if (!signing) {
        const partNumbers: number[] = []
        for (let n = partNumber; n <= session.partCount && partNumbers.length < SIGN_BATCH; n += 1) {
          if (!session.parts.has(n)) partNumbers.push(n)
        }
        signing = $fetch<{ parts: { partNumber: number; url: string }[] }>(
          '/api/gallery/admin/vault/sign-parts',
          { method: 'POST', body: { key: session.key, uploadId: session.uploadId, partNumbers } },
        )
          .then(({ parts }) => {
            const signedAt = Date.now()
            for (const part of parts) urls.set(part.partNumber, { url: part.url, signedAt })
          })
          .finally(() => {
            signing = null
          })
      }
      await signing
    }
  }

  // Once one part has given up, the others stop taking new work.
  let failed = false

  async function uploadPart(partNumber: number) {
    const start = (partNumber - 1) * session.partSize
    const blob = file.slice(start, start + partBytes(partNumber))
    let failures = 0

    for (;;) {
      await ready()
      if (failed || superseded()) return
      const seen = interruptions

      try {
        const etag = await putBlob(await urlFor(partNumber), blob, (bytes) => {
          loaded.set(partNumber, bytes)
          report()
        })
        session.parts.set(partNumber, etag)
        loaded.set(partNumber, blob.size)
        report()
        return
      } catch (error) {
        loaded.set(partNumber, 0)
        report()

        if (isGone(error)) throw error
        // An expired or rejected URL will not work a second time.
        if (error instanceof PartError && error.status === 403) urls.delete(partNumber)

        const interrupted = interruptions !== seen || !canSend()
        if (!interrupted) failures += 1
        if (failures >= MAX_ATTEMPTS) throw error
        if (!interrupted) await wait(1000 * 2 ** (failures - 1))
      }
    }
  }

  const queue = Array.from({ length: session.partCount }, (_, i) => i + 1).filter(
    (partNumber) => !session.parts.has(partNumber),
  )

  async function worker() {
    for (let partNumber = queue.shift(); partNumber; partNumber = queue.shift()) {
      if (failed || superseded()) return
      try {
        await uploadPart(partNumber)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, queue.length) }, worker))
    // Never report success for an upload that was abandoned part-way.
    if (superseded()) throw new Error('Upload cancelled.')

    for (let failures = 0; ; ) {
      await ready()
      const seen = interruptions
      try {
        await $fetch('/api/gallery/admin/vault/complete', {
          method: 'POST',
          body: {
            key: session.key,
            uploadId: session.uploadId,
            parts: [...session.parts].map(([partNumber, etag]) => ({ partNumber, etag })),
          },
        })
        break
      } catch (error) {
        if (isGone(error)) throw error
        if (interruptions === seen && canSend()) failures += 1
        if (failures >= MAX_ATTEMPTS) throw error
        await wait(1000)
      }
    }

    resume.session = undefined
  } catch (error) {
    if (isGone(error)) {
      // Nothing left to resume. The next attempt starts a fresh upload.
      resume.session = undefined
      throw new Error('This upload expired on R2. Retry to start it again.')
    }
    throw error
  }
}

/** Give up on an unfinished upload for good, freeing the parts R2 is holding. */
export function abandonVaultUpload(resume: VaultResume) {
  const session = resume.session
  resume.run = undefined
  resume.session = undefined
  if (!session) return

  $fetch('/api/gallery/admin/vault/abort', {
    method: 'POST',
    body: { key: session.key, uploadId: session.uploadId },
  }).catch(() => undefined)
}
