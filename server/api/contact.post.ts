import {
  formatReceived,
  renderAutoReply,
  renderAutoReplyText,
  renderContactEmail,
  renderContactText,
  subjectSnippet,
  type ContactMessage,
} from '../utils/contact-email'
import { consume } from '../utils/rate-limit'

/**
 * Contact form submissions, handled directly.
 *
 * This replaces a Netlify outgoing webhook that never fired. The old path was
 * browser -> Netlify -> back to this server -> Resend, with a JWS handshake in
 * the middle and a delivery log we could not inspect. This is browser -> here
 * -> Resend, with storage in Netlify Forms as a side effect, so the whole
 * chain is testable from outside.
 *
 * The email is sent first and storage second: if archiving fails, the message
 * has still reached a human, which is the part that actually matters.
 */

const MAX_PER_WINDOW = 5
const WINDOW_SECONDS = 10 * 60

/** Deliberately loose - this is a sanity check, not address validation. */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Coerced: Nuxt parses env with `destr`, so values are not guaranteed strings.
  const apiKey = String(config.resendApiKey ?? '')
  const to = String(config.contactToEmail ?? '')
  const from = String(config.contactFromEmail ?? '')

  if (!apiKey || !to || !from) {
    throw createError({ statusCode: 503, statusMessage: 'Contact is not configured.' })
  }

  const forwarded =
    getRequestHeader(event, 'x-nf-client-connection-ip') ||
    getRequestHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'

  const limit = consume(`contact:${ip}`, MAX_PER_WINDOW, WINDOW_SECONDS)
  if (!limit.ok) {
    setResponseHeader(event, 'retry-after', String(limit.retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many messages. Please try again shortly.',
    })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const text = (value: unknown, max: number) =>
    typeof value === 'string' ? value.trim().slice(0, max) : ''

  // Honeypot: a human never sees this field, so anything in it is a bot.
  // Answer 200 so the bot believes it succeeded and does not retry.
  if (text(body?.['bot-field'], 100)) return { ok: true }

  const name = text(body?.name, 200)
  const email = text(body?.email, 320)
  const message = text(body?.message, 5000)

  if (!name || !email || !message) {
    throw createError({ statusCode: 400, statusMessage: 'Please fill in every field.' })
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'That email address looks wrong.' })
  }

  const payload: ContactMessage = {
    name,
    email,
    message,
    // Rendered in JKC's own timezone; toUTCString would show GMT, which is
    // never the time he actually received it.
    receivedAt: formatReceived(new Date()),
    siteUrl: String(config.public.siteUrl ?? 'https://iamjkc.space'),
  }

  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {
        from,
        to: [to],
        // Carry a snippet so the inbox list says what the message is about.
        subject: `${name}: ${subjectSnippet(message)}`,
        html: renderContactEmail(payload),
        text: renderContactText(payload),
        // Replying reaches the sender rather than our own address.
        reply_to: email,
      },
    })
  } catch (error) {
    // Translate rather than propagate: Resend answers a bad key with 401, and
    // surfacing that verbatim would tell the visitor they are unauthorised.
    console.error('[contact] Resend rejected the send:', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not send your message. Please email me directly.',
    })
  }

  /*
   * Confirmation back to the sender. Best effort: they already got a "sent"
   * in the UI and the real message is delivered, so a failure here is not
   * worth turning into an error for either party.
   *
   * Note this is an unverified address - anyone can put someone else's email
   * in the form and cause one message from this domain. The per-IP limit above
   * is what keeps that from being useful for amplification.
   */
  try {
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {
        from,
        to: [email],
        subject: 'Thanks for getting in touch',
        html: renderAutoReply(payload),
        text: renderAutoReplyText(payload),
        // If they reply to the confirmation, it should reach a person.
        reply_to: to,
      },
    })
  } catch (error) {
    console.error('[contact] Could not send the confirmation:', error)
  }

  /*
   * Archive to Netlify Forms. Best effort and deliberately after the send -
   * the message is already with a human, so a storage failure must not be
   * reported to the visitor as a failure to send.
   */
  try {
    await $fetch(payload.siteUrl.replace(/\/$/, '') + '/forms.html', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'form-name': 'contact',
        name,
        email,
        message,
      }).toString(),
    })
  } catch (error) {
    console.error('[contact] Could not archive to Netlify Forms:', error)
  }

  return { ok: true }
})
