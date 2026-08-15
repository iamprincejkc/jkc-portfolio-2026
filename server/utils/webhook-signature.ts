import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verification for Netlify's outgoing-webhook signature.
 *
 * Netlify signs each delivery with an HS256 JWS whose payload carries a
 * SHA-256 of the request body. Both halves matter: the signature proves the
 * token came from Netlify, and the body hash proves this token belongs to
 * *this* request. Checking only the signature would let a captured token be
 * replayed against attacker-chosen content.
 *
 * Lives in utils rather than in the route so it can be tested directly.
 */

function base64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function verifyWebhookSignature(
  token: string | undefined | null,
  secret: string,
  rawBody: string,
): boolean {
  if (!token || !secret) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [header, payload, signature] = parts
  if (!header || !payload || !signature) return false

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  const actual = base64urlToBuffer(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false

  try {
    const claims = JSON.parse(base64urlToBuffer(payload).toString('utf8')) as {
      sha256?: unknown
    }
    if (typeof claims.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(claims.sha256)) {
      return false
    }

    const a = Buffer.from(claims.sha256, 'hex')
    const b = createHash('sha256').update(rawBody).digest()
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
