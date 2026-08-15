import { renderContactEmail, renderContactText, type ContactMessage } from '../utils/contact-email'
import { verifyWebhookSignature } from '../utils/webhook-signature'
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
  if (!token || !verifyWebhookSignature(token, secret, rawBody)) {
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
