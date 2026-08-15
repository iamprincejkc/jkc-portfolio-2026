/**
 * Fixed-window rate limiter, in-process.
 *
 * This stops PIN brute-forcing from a single client and costs nothing to run.
 * It is *per instance*: on Netlify Functions an attacker spread across many
 * cold instances gets a higher effective ceiling.
 *
 * If you need a hard global limit, swap the body of `consume` for a Redis
 * INCR/EXPIRE against Upstash - the signature is designed to stay the same.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 5_000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  ok: boolean
  /** Attempts left in the current window. */
  remaining: number
  /** Seconds until the window resets. */
  retryAfter: number
}

export function consume(
  key: string,
  limit: number,
  windowSeconds: number,
  now = Date.now(),
): RateLimitResult {
  sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, retryAfter: windowSeconds }
  }

  existing.count += 1
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))

  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter }
  }

  return { ok: true, remaining: limit - existing.count, retryAfter }
}

/** Clear a key after a successful auth so one typo does not burn the window. */
export function resetKey(key: string) {
  buckets.delete(key)
}

/** Test seam. */
export function __clearAll() {
  buckets.clear()
}
