import { createHmac, timingSafeEqual, createHash } from 'node:crypto'
import { renderContactEmail, renderContactText, type ContactMessage } from '../utils/contact-email'
import { consume } from '../utils/rate-limit'

/**
 * Receives Netlify's form-submission webhook and sends a designed email.
 *
 * Netlify's own notification email cannot be templated, so Netlify Forms is
 * kept for storage and spam filtering while the actual email is sent from our
 * domain through Resend - with reply-to pointing at the sender, so replying
 * reaches the person rather than netlify.com.
 *
 * This endpoint is publicly reachable and it sends mail, which makes it an
 * open relay if left unauthenticated. Netlify signs each delivery with a JWS
 * token; that signature is required, and the handler refuses to run without a
 * configured secret rather than falling back to trusting the caller.
 */

/** Netlify's payload. Only the fields actually used are typed. */
type NetlifyFormPayload = {
  form_name?: string
  created_at?: string
  site_url?: string
  data?: Record<string, unknown>
}

function base64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/**
 * Verify Netlify's `x-webhook-signature`: an HS256 JWS whose payload carries a
 * SHA-256 of the request body. Both the signature and the body hash are
 * checked - the signature alone would let a valid token be replayed against
 * different content.
 */
function verifySignature(token: string, secret: string, rawBody: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [header, payload, signature] = parts

  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  const actual = base64urlToBuffer(signature)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false

  try {
    const claims = JSON.parse(base64urlToBuffer(payload).toString('utf8')) as { sha256?: string }
    if (!claims.sha256) return false

    const bodyHash = createHash('sha256').update(rawBody).digest('hex')
    const a = Buffer.from(claims.sha256, 'hex')
    const b = Buffer.from(bodyHash, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Coerced: Nuxt parses env with `destr`, so values are not guaranteed strings.
  const secret = String(config.netlifyWebhookSecret ?? '')
  const apiKey = String(config.resendApiKey ?? '')
  const to = String(config.contactToEmail ?? '')
  const from = String(config.contactFromEmail ?? '')

  if (!secret || !apiKey || !to || !from) {
    // Fail closed. Netlify Forms still has the submission either way.
    throw createError({ statusCode: 503, statusMessage: 'Contact email is not configured.' })
  }

  // Cheap ceiling in case the signature check is ever loosened.
  if (!consume('form-webhook', 30, 60).ok) {
    throw createError({ statusCode: 429, statusMessage: 'Too many submissions.' })
  }

  const rawBody = await readRawBody(event, 'utf8')
  if (!rawBody) throw createError({ statusCode: 400, statusMessage: 'Empty body.' })

  const token = getRequestHeader(event, 'x-webhook-signature')
  if (!token || !verifySignature(token, secret, rawBody)) {
    throw createError({ statusCode: 401, statusMessage: 'Bad signature.' })
  }

  let payload: NetlifyFormPayload
  try {
    payload = JSON.parse(rawBody) as NetlifyFormPayload
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Malformed payload.' })
  }

  const fields = payload.data ?? {}
  const message: ContactMessage = {
    name: text(fields.name, 200) || 'Someone',
    email: text(fields.email, 320),
    message: text(fields.message, 5000) || '(no message)',
    receivedAt: new Date(payload.created_at ?? Date.now()).toUTCString(),
    siteUrl: payload.site_url ?? 'https://iamjkc.space',
  }

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {
        from,
        to: [to],
        subject: `${message.name} sent you a message`,
        html: renderContactEmail(message),
        text: renderContactText(message),
        // Replying goes to the person who wrote in, not to our own sender.
        reply_to: message.email || undefined,
      },
    })
  } catch (error) {
    /*
     * Translate the upstream status instead of letting it through. Resend
     * answers a bad API key with 401, and $fetch propagates that verbatim -
     * so a misconfigured key would surface here as "Bad signature", which is
     * exactly the wrong thing to be told while debugging. It also made the
     * signature tests look like they were failing when they were passing.
     */
    console.error('[form-webhook] Resend rejected the send:', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not send the notification email.',
    })
  }

  return { ok: true }
})
