/**
 * Templates for the two contact emails: the notification to JKC, and the
 * confirmation sent back to whoever wrote in.
 *
 * Email clients are not browsers. No external stylesheets, no webfonts, no
 * flexbox or grid worth relying on, and Outlook renders almost nothing
 * predictably except tables with inline styles. Everything here is written to
 * that constraint rather than to what looks tidy in a browser.
 *
 * The look follows the landing page: warm paper ground, a white card with a
 * thin amber stripe, the "J." logo and JKC's name in the header, one dark
 * button, and a signature with his photo. Images are absolute URLs on the
 * site the form was sent from (never hard-coded to a domain), PNG and JPEG
 * only, because Outlook and older Gmail apps do not show WebP or SVG. It
 * declares itself light-only. A client that forces dark mode will still
 * invert it, but nothing here relies on a colour surviving that.
 *
 * Copy rules match the landing page: no em dashes, no prices, and JKC is a
 * Senior Software Engineer.
 */

const INK = '#17150f'
const MUTED = '#57534a'
const FAINT = '#8a867c'
const PAGE = '#f3f1ec'
const CARD = '#ffffff'
const SOFT = '#faf8f4'
const LINE = '#e7e3da'
const ACCENT = '#8a5a12'

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const SERIF = "Georgia,'Times New Roman',serif"

/** The name every email is sent under, so the inbox shows a person, not an address. */
export const SENDER_NAME = 'Jan Kevin Cadampog'

/**
 * `contact@iamjkc.space` becomes `Jan Kevin Cadampog <contact@iamjkc.space>`.
 * An address that already carries a display name is left alone.
 */
export function withSenderName(from: string): string {
  const trimmed = from.trim()
  return /<[^>]*>/.test(trimmed) || !trimmed ? trimmed : `${SENDER_NAME} <${trimmed}>`
}

/** Subject of the confirmation: personal, and says what it is. */
export function autoReplySubject(name: string): string {
  return `Thanks for your message, ${firstName(name)}`
}

export type ContactMessage = {
  name: string
  /** Empty when they left only a phone number. One of the two is always set. */
  email: string
  message: string
  /** Optional: the business they are writing about. */
  business?: string
  /** Optional: a number to call or message back on. */
  phone?: string
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

/**
 * A phone number as a `tel:` target: digits and a leading plus only, so
 * whatever spacing or dashes they typed still dials.
 */
export function telHref(phone: string): string {
  const trimmed = phone.trim()
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${trimmed.replace(/\D/g, '')}`
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

/** Absolute URL on the site the message came from. */
function asset(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, '')}${path}`
}

function shell(title: string, preheader: string, siteUrl: string, inner: string): string {
  const host = siteHost(siteUrl)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
<!-- Narrow screens: tighter card padding, and the site address leaves the header.
     Clients that ignore <style> keep the desktop layout, which still fits. -->
<style>
  @media only screen and (max-width: 480px) {
    .pad { padding-left: 22px !important; padding-right: 22px !important; }
    .hide-sm { display: none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-font-smoothing:antialiased;">
  <!-- Inbox preview line. Hidden in the body itself; the padding stops the
       client pulling body text in after it. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:32px 12px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
          <tr>
            <td style="padding:0 4px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="48" valign="middle" style="width:48px;">
                    <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                      <img src="${escapeHtml(asset(siteUrl, '/icon-192.png'))}" width="40" height="40" alt="JKC" style="display:block;width:40px;height:40px;border:0;border-radius:9px;" />
                    </a>
                  </td>
                  <td valign="middle" style="padding-left:12px;">
                    <div style="font:600 15px/1.3 ${SANS};color:${INK};">${SENDER_NAME}</div>
                    <div style="font:400 13px/1.4 ${SANS};color:${MUTED};">Senior Software Engineer</div>
                  </td>
                  <td class="hide-sm" align="right" valign="middle" style="font:500 13px/1.4 ${SANS};">
                    <a href="${escapeHtml(siteUrl)}" style="color:${MUTED};text-decoration:none;">${escapeHtml(host)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${inner}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** The white card, with the amber stripe across its top edge. */
function card(inner: string, tail = ''): string {
  return `
  <tr>
    <td style="background:${CARD};border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${ACCENT};border-radius:16px 16px 0 0;">&nbsp;</td></tr>
        <tr><td class="pad" style="padding:36px 36px 32px;">${inner}</td></tr>
        ${tail}
      </table>
    </td>
  </tr>`
}

function footnote(html: string): string {
  return `
  <tr>
    <td style="padding:20px 8px 0;font:400 12px/1.65 ${SANS};color:${FAINT};text-align:center;">
      ${html}
    </td>
  </tr>`
}

function eyebrow(text: string): string {
  return `<div style="padding:0 0 10px;font:700 11px/1.4 ${SANS};letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">${escapeHtml(text)}</div>`
}

function heading(html: string): string {
  return `<div style="padding:0 0 14px;font:600 26px/1.25 ${SANS};letter-spacing:-0.02em;color:${INK};">${html}</div>`
}

function paragraph(html: string, last = false): string {
  return `<div style="padding:0 0 ${last ? 0 : 24}px;font:400 15px/1.7 ${SANS};color:${MUTED};">${html}</div>`
}

function label(text: string): string {
  return `<div style="padding:0 0 10px;font:600 13px/1.4 ${SANS};color:${INK};">${escapeHtml(text)}</div>`
}

/** One labelled line of the details list, ruled off from the one above. */
function detail(name: string, value: string): string {
  return `
  <tr>
    <td width="96" valign="top" style="width:96px;padding:12px 0;border-top:1px solid ${LINE};font:400 13px/1.5 ${SANS};color:${FAINT};">${escapeHtml(name)}</td>
    <td valign="top" style="padding:12px 0;border-top:1px solid ${LINE};font:500 14px/1.5 ${SANS};color:${INK};">${value}</td>
  </tr>`
}

/** Their words, set apart with an amber rule so they read as a quotation rather than as ours. */
function quote(message: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="background:${SOFT};border-left:3px solid ${ACCENT};border-radius:0 10px 10px 0;padding:16px 20px;font:400 15px/1.65 ${SANS};color:${INK};">
        ${formatMessage(message)}
      </td>
    </tr>
  </table>`
}

/**
 * A button. The fill sits on the table cell, not the link: Outlook drops
 * backgrounds and padding on an `<a>` but keeps them on a cell.
 */
function button(href: string, text: string, kind: 'solid' | 'outline' = 'solid'): string {
  const solid = kind === 'solid'
  const cell = solid ? `background:${INK};` : `background:${CARD};border:1px solid ${LINE};`
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:0 8px 8px 0;">
    <tr>
      <td ${solid ? `bgcolor="${INK}"` : ''} style="${cell}border-radius:999px;">
        <a href="${href}" style="display:inline-block;padding:13px 22px;font:600 14px/1 ${SANS};color:${solid ? '#ffffff' : INK};text-decoration:none;border-radius:999px;">${text}</a>
      </td>
    </tr>
  </table>`
}

/** A numbered step: dark disc, title, one line of detail. */
function step(n: number, title: string, body: string): string {
  return `
  <tr>
    <td width="40" valign="top" style="width:40px;padding:0 0 18px;">
      <div style="width:26px;height:26px;border-radius:13px;background:${INK};color:#ffffff;font:600 13px/26px ${SANS};text-align:center;">${n}</div>
    </td>
    <td valign="top" style="padding:2px 0 18px;">
      <div style="font:600 15px/1.4 ${SANS};color:${INK};">${escapeHtml(title)}</div>
      <div style="padding-top:3px;font:400 14px/1.6 ${SANS};color:${MUTED};">${escapeHtml(body)}</div>
    </td>
  </tr>`
}

/** The steps the confirmation promises. Kept in step with the landing page's "How it works". */
const NEXT_STEPS: [string, string][] = [
  ['I look at your business', 'I read your message and check how you show up online today: your Facebook page, Google, and any website you already have.'],
  ['You get ideas and a quote', 'I reply with what I would build for you and a price that fits your budget. The price is always open to discussion.'],
  ['A free first draft', 'If it sounds right, I make a first draft of your homepage, so you can see it before you decide anything.'],
]

/** The notification that goes to JKC. */
export function renderContactEmail(msg: ContactMessage): string {
  const host = siteHost(msg.siteUrl)
  const first = escapeHtml(firstName(msg.name))
  const mailto = `mailto:${encodeURI(msg.email)}?subject=${encodeURIComponent(`Re: your message via ${host}`)}`
  const link = (href: string, text: string) =>
    `<a href="${href}" style="color:${INK};text-decoration:underline;">${escapeHtml(text)}</a>`

  // No email means they asked to be called or messaged back.
  const actions = [
    msg.email ? button(mailto, `Reply to ${first}`) : '',
    msg.phone ? button(telHref(msg.phone), `Call ${first}`, msg.email ? 'outline' : 'solid') : '',
  ].join('')

  const rows = [
    detail('Name', escapeHtml(msg.name)),
    msg.business ? detail('Business', escapeHtml(msg.business)) : '',
    msg.email ? detail('Email', link(`mailto:${encodeURI(msg.email)}`, msg.email)) : '',
    msg.phone ? detail('Phone', link(telHref(msg.phone), msg.phone)) : '',
    detail('Received', escapeHtml(msg.receivedAt)),
  ].join('')

  const title = msg.business
    ? `${escapeHtml(msg.name)} <span style="font-weight:400;color:${MUTED};">from</span> ${escapeHtml(msg.business)}`
    : `${escapeHtml(msg.name)} got in touch`

  const inner = card(`
      ${eyebrow('New enquiry')}
      ${heading(title)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;border-bottom:1px solid ${LINE};">
        ${rows}
      </table>
      ${label('Their message')}
      ${quote(msg.message)}
      <div style="padding:28px 0 0;font-size:0;">${actions}</div>
  `)

  const note = msg.email
    ? `Replying to this email goes straight to ${first}.`
    : `${first} left no email address, so call or message them back.`

  return shell(
    `New enquiry from ${msg.name}`,
    `${msg.name}${msg.business ? ` (${msg.business})` : ''}: ${subjectSnippet(msg.message, 90)}`,
    msg.siteUrl,
    `${inner}
    ${footnote(`Sent from the contact form on <a href="${escapeHtml(msg.siteUrl)}" style="color:${FAINT};text-decoration:underline;">${escapeHtml(host)}</a>. ${note}`)}`,
  )
}

export function renderContactText(msg: ContactMessage): string {
  return [
    `NEW ENQUIRY - ${siteHost(msg.siteUrl)}`,
    '',
    `From:     ${msg.name}`,
    ...(msg.business ? [`Business: ${msg.business}`] : []),
    ...(msg.email ? [`Email:    ${msg.email}`] : []),
    ...(msg.phone ? [`Phone:    ${msg.phone}`] : []),
    '',
    'Message:',
    msg.message,
    '',
    '--',
    msg.email
      ? `Received ${msg.receivedAt}. Reply directly to reach ${firstName(msg.name)}.`
      : `Received ${msg.receivedAt}. No email given: call or message ${firstName(msg.name)} back.`,
  ].join('\n')
}

/** The work section of the landing page, tagged so GA4 shows these visits as coming from this email. */
function workUrl(siteUrl: string): string {
  return asset(siteUrl, '/?utm_source=contact_auto_reply&utm_medium=email&utm_campaign=contact_form#work')
}

/**
 * The confirmation sent back to the sender.
 *
 * It reassures them the message arrived, says what happens next and when,
 * gives them a copy of what they wrote, and offers one thing to do while
 * they wait: look at the work.
 */
export function renderAutoReply(msg: ContactMessage): string {
  const host = siteHost(msg.siteUrl)
  const first = escapeHtml(firstName(msg.name))

  const signature = `
        <tr>
          <td class="pad" style="padding:24px 36px;background:${SOFT};border-top:1px solid ${LINE};border-radius:0 0 16px 16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="64" valign="middle" style="width:64px;">
                  <img src="${escapeHtml(asset(msg.siteUrl, '/images/email/headshot.jpg'))}" width="52" height="52" alt="Jan Kevin Cadampog" style="display:block;width:52px;height:52px;border:0;border-radius:26px;" />
                </td>
                <td valign="middle">
                  <div style="font:600 15px/1.35 ${SANS};color:${INK};">${SENDER_NAME}</div>
                  <div style="font:400 13px/1.5 ${SANS};color:${MUTED};">Senior Software Engineer &middot; Websites and business systems</div>
                  <div style="padding-top:4px;font:500 13px/1.5 ${SANS};">
                    <a href="${escapeHtml(msg.siteUrl)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(host)}</a>
                    <span style="color:${LINE};">&nbsp;|&nbsp;</span>
                    <a href="https://ph.linkedin.com/in/iamprincejkc" style="color:${ACCENT};text-decoration:none;">LinkedIn</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`

  const inner = card(
    `
      ${eyebrow('Message received')}
      ${heading(`Thanks for reaching out, <span style="font-family:${SERIF};font-weight:400;color:${ACCENT};">${first}.</span>`)}
      ${paragraph(
        'Your message is safely in my inbox. I read every enquiry myself and will get back to you within one to two business days, often sooner.',
      )}

      ${label('What happens next')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 10px;">
        ${NEXT_STEPS.map(([t, b], i) => step(i + 1, t, b)).join('')}
      </table>

      ${label('Your message')}
      ${quote(msg.message)}

      <div style="padding:28px 0 4px;font-size:0;">${button(workUrl(msg.siteUrl), 'See my recent work')}</div>
      ${paragraph('Anything to add in the meantime? Just reply to this email.', true)}
  `,
    signature,
  )

  return shell(
    'Thanks for your message',
    `I got your message and will reply personally within one to two business days.`,
    msg.siteUrl,
    `${inner}
    ${footnote(
      `You are receiving this because you sent a message through the contact form on <a href="${escapeHtml(msg.siteUrl)}" style="color:${FAINT};text-decoration:underline;">${escapeHtml(host)}</a>.<br />This is an automatic confirmation, but replying to it reaches me directly.`,
    )}`,
  )
}

export function renderAutoReplyText(msg: ContactMessage): string {
  return [
    `Thanks for reaching out, ${firstName(msg.name)}.`,
    '',
    'Your message is safely in my inbox. I read every enquiry myself and will get',
    'back to you within one to two business days, often sooner.',
    '',
    'What happens next:',
    ...NEXT_STEPS.map(([t, b], i) => `${i + 1}. ${t}. ${b}`),
    '',
    'Your message:',
    msg.message,
    '',
    `See my recent work: ${workUrl(msg.siteUrl)}`,
    '',
    'Anything to add in the meantime? Just reply to this email.',
    '',
    '--',
    SENDER_NAME,
    'Senior Software Engineer, websites and business systems',
    msg.siteUrl,
    '',
    'This is an automatic confirmation, but replying to it reaches me directly.',
  ].join('\n')
}
