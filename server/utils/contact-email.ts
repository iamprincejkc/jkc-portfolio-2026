/**
 * Templates for the two contact emails: the notification to JKC, and the
 * confirmation sent back to whoever wrote in.
 *
 * Email clients are not browsers. No external stylesheets, no webfonts, no
 * flexbox or grid worth relying on, and Outlook renders almost nothing
 * predictably except tables with inline styles. Everything here is written to
 * that constraint rather than to what looks tidy in a browser.
 *
 * The look is deliberately plain: a white card on a pale ground, one system
 * typeface, hairlines rather than fills, and black for the one action. It
 * declares itself light-only. A client that forces dark mode will still
 * invert it, but nothing here relies on a colour surviving that.
 */

const INK = '#18181b'
const MUTED = '#52525b'
const FAINT = '#a1a1aa'
const PAGE = '#f4f4f5'
const CARD = '#ffffff'
const QUOTE_BG = '#fafafa'
const LINE = '#e4e4e7'

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export type ContactMessage = {
  name: string
  email: string
  message: string
  /** Already formatted for display; see formatReceived. */
  receivedAt: string
  siteUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Preserve the sender's line breaks without letting their markup through. */
function formatMessage(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

/**
 * Render the timestamp in JKC's own timezone. The default toUTCString gives
 * GMT, which is never the time he actually received it.
 */
export function formatReceived(date: Date, timeZone = 'Asia/Manila'): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return date.toUTCString()
  }
}

/** First word of a name, for a greeting. Falls back to something neutral. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there'
}

/** One-line inbox preview. Long messages get an ellipsis rather than a wall. */
export function subjectSnippet(message: string, limit = 68): string {
  const flat = message.replace(/\s+/g, ' ').trim()
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1)}…`
}

/**
 * The bare host, for the places the email shows the site by name rather than
 * links to it: `iamjkc.space` from `https://iamjkc.space/`.
 *
 * Derived from the configured site URL rather than written into the template,
 * so moving to a new domain stays what it should be - one environment
 * variable - instead of a hunt through an email template for six string
 * literals that still name the old one.
 */
export function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host
  } catch {
    // A misconfigured NUXT_PUBLIC_SITE_URL must not take the contact form
    // down; an email with no site name still delivers the message.
    return siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

/**
 * Resend's shared sender. It needs no domain of our own, but Resend only
 * delivers from it to the address the Resend account was registered with.
 */
export const RESEND_TEST_SENDER = 'onboarding@resend.dev'

/**
 * Did Resend refuse the send because the From domain is not verified?
 *
 * That is what happens when the domain lapses: iamjkc.space expired and left
 * DNS, its DKIM and SPF records went with it, and every send answered 403 -
 * on Netlify and Cloudflare alike. Matched narrowly on Resend's own wording so
 * a bad key or a malformed address still fails loudly instead of being
 * quietly rerouted.
 */
export function isUnverifiedDomain(error: unknown): boolean {
  const e = error as { statusCode?: number; status?: number; data?: { message?: unknown } } | null
  const status = e?.statusCode ?? e?.status
  return status === 403 && /domain is not verified/i.test(String(e?.data?.message ?? ''))
}

/**
 * The configured sender with its address swapped for Resend's shared one,
 * keeping the display name: `JKC <hello@iamjkc.space>` becomes
 * `JKC <onboarding@resend.dev>`. A bare address gets a name, so the inbox
 * says what the message is rather than showing Resend's address.
 */
export function fallbackSender(from: string): string {
  return /<[^>]*>/.test(from)
    ? from.replace(/<[^>]*>/, `<${RESEND_TEST_SENDER}>`)
    : `Portfolio contact <${RESEND_TEST_SENDER}>`
}

function shell(title: string, preheader: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-font-smoothing:antialiased;">
  <!-- Inbox preview line. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 18px;font:700 14px/1 ${SANS};letter-spacing:-0.01em;color:${INK};">JKC</td>
          </tr>
          ${inner}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function card(inner: string): string {
  return `
  <tr>
    <td style="background:${CARD};border:1px solid ${LINE};border-radius:12px;padding:36px 32px;">
      ${inner}
    </td>
  </tr>`
}

function footnote(html: string): string {
  return `
  <tr>
    <td style="padding:18px 4px 0;font:400 12px/1.6 ${SANS};color:${FAINT};">
      ${html}
    </td>
  </tr>`
}

/** One labelled line of the details list, ruled off from the one above. */
function detail(label: string, value: string): string {
  return `
  <tr>
    <td width="84" valign="top" style="padding:11px 0;border-top:1px solid ${LINE};font:400 13px/1.5 ${SANS};color:${FAINT};">${escapeHtml(label)}</td>
    <td valign="top" style="padding:11px 0;border-top:1px solid ${LINE};font:400 14px/1.5 ${SANS};color:${INK};">${value}</td>
  </tr>`
}

/** Their words, set apart so they read as a quotation rather than as ours. */
function quote(message: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background:${QUOTE_BG};border:1px solid ${LINE};border-radius:8px;padding:18px 20px;font:400 15px/1.65 ${SANS};color:${INK};">
        ${formatMessage(message)}
      </td>
    </tr>
  </table>`
}

/**
 * The one action. The fill sits on the table cell, not the link: Outlook
 * drops backgrounds and padding on an `<a>` but keeps them on a cell.
 */
function button(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td bgcolor="${INK}" style="background:${INK};border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 20px;font:600 14px/1 ${SANS};color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`
}

/** The notification that goes to JKC. */
export function renderContactEmail(msg: ContactMessage): string {
  const host = siteHost(msg.siteUrl)
  const first = escapeHtml(firstName(msg.name))
  const mailto = `mailto:${encodeURI(msg.email)}?subject=${encodeURIComponent(`Re: your message via ${host}`)}`

  const inner = `
  ${card(`
      <div style="padding:0 0 6px;font:500 13px/1.4 ${SANS};color:${MUTED};">New message</div>
      <div style="padding:0 0 24px;font:600 22px/1.3 ${SANS};letter-spacing:-0.01em;color:${INK};">${escapeHtml(msg.name)} got in touch</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid ${LINE};">
        ${detail(
          'Email',
          `<a href="mailto:${encodeURI(msg.email)}" style="color:${INK};text-decoration:underline;">${escapeHtml(msg.email)}</a>`,
        )}
        ${detail('Received', escapeHtml(msg.receivedAt))}
      </table>

      <div style="padding:24px 0 0;">${quote(msg.message)}</div>
      <div style="padding:28px 0 0;">${button(mailto, `Reply to ${first}`)}</div>
  `)}
  ${footnote(
    `Sent from the contact form on <a href="${escapeHtml(msg.siteUrl)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(host)}</a>.
    Replying to this email goes straight to ${first}.`,
  )}`

  return shell(`New message from ${msg.name}`, `${msg.name}: ${subjectSnippet(msg.message, 90)}`, inner)
}

export function renderContactText(msg: ContactMessage): string {
  return [
    `NEW ENQUIRY — ${siteHost(msg.siteUrl)}`,
    '',
    `From:    ${msg.name}`,
    `Email:   ${msg.email}`,
    '',
    'Message:',
    msg.message,
    '',
    '--',
    `Received ${msg.receivedAt}. Reply directly to reach ${firstName(msg.name)}.`,
  ].join('\n')
}

/**
 * The confirmation sent back to the sender.
 *
 * Deliberately restrained: it exists to reassure them the message arrived and
 * to leave them a copy. It quotes what they wrote so the email is useful on
 * its own rather than being a bare "thanks".
 */
export function renderAutoReply(msg: ContactMessage): string {
  const host = siteHost(msg.siteUrl)
  const inner = `
  ${card(`
      <div style="padding:0 0 12px;font:600 22px/1.3 ${SANS};letter-spacing:-0.01em;color:${INK};">Thanks, ${escapeHtml(firstName(msg.name))}.</div>
      <div style="padding:0 0 24px;font:400 15px/1.65 ${SANS};color:${MUTED};">
        Your message reached me and I'll reply personally, usually within a
        day or two. No action needed from you in the meantime.
      </div>

      <div style="padding:0 0 8px;font:500 13px/1.4 ${SANS};color:${MUTED};">What you sent</div>
      ${quote(msg.message)}

      <div style="margin:28px 0 0;padding:20px 0 0;border-top:1px solid ${LINE};">
        <div style="font:600 14px/1.5 ${SANS};color:${INK};">Jan Kevin Cadampog</div>
        <div style="font:400 13px/1.5 ${SANS};color:${MUTED};">Software Engineer &middot; Cebu City</div>
        <div style="padding-top:8px;font:400 13px/1.5 ${SANS};">
          <a href="${escapeHtml(msg.siteUrl)}" style="color:${INK};text-decoration:underline;">${escapeHtml(host)}</a>
        </div>
      </div>
  `)}
  ${footnote('This is an automatic confirmation, but replying to it does reach me.')}`

  return shell('Thanks for getting in touch', `Thanks for getting in touch — I'll reply personally.`, inner)
}

export function renderAutoReplyText(msg: ContactMessage): string {
  return [
    `Thanks, ${firstName(msg.name)}.`,
    '',
    "Your message reached me and I'll reply personally, usually within a day",
    'or two. No action needed from you in the meantime.',
    '',
    'What you sent:',
    msg.message,
    '',
    '--',
    'Jan Kevin Cadampog',
    'Software Engineer, Cebu City',
    msg.siteUrl,
    '',
    'This is an automatic confirmation, but replying to it does reach me.',
  ].join('\n')
}
