/**
 * Templates for the two contact emails: the notification to JKC, and the
 * confirmation sent back to whoever wrote in.
 *
 * Email clients are not browsers. No external stylesheets, no webfonts, no
 * flexbox or grid worth relying on, and Outlook renders almost nothing
 * predictably except tables with inline styles. Everything here is written to
 * that constraint rather than to what looks tidy in a browser.
 *
 * Melodrama cannot be loaded, so the display face falls back to a serif stack.
 * That is deliberate: a webfont that fails leaves the heading in whatever the
 * client picks, which is worse than choosing the fallback ourselves.
 */

const INK = '#fafafa'
const MUTED = '#8c8c8c'
const FAINT = '#5f5f5f'
const BG = '#0a0a0a'
const SURFACE = '#151515'
const QUOTE_BG = '#1c1c1c'
const ACCENT = '#e8d4a0'
const LINE = '#2b2b2b'

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const SERIF = "Georgia,'Times New Roman',Times,serif"

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

function shell(preheader: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>iamjkc.space</title>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-font-smoothing:antialiased;">
  <!-- Inbox preview line. Hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
          ${inner}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function wordmark(): string {
  return `
  <tr>
    <td style="padding:0 4px 22px;">
      <span style="font:600 13px/1 ${SANS};letter-spacing:0.02em;color:${INK};">JKC</span>
      <span style="font:400 13px/1 ${SANS};color:${FAINT};">&nbsp;&nbsp;iamjkc.space</span>
    </td>
  </tr>`
}

function field(label: string, value: string): string {
  return `
  <tr>
    <td style="padding:0 0 6px;font:600 10px/1.4 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${FAINT};">
      ${escapeHtml(label)}
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 24px;font:400 16px/1.45 ${SANS};color:${INK};">
      ${value}
    </td>
  </tr>`
}

/** The notification that goes to JKC. */
export function renderContactEmail(msg: ContactMessage): string {
  const mailto = `mailto:${encodeURI(msg.email)}?subject=${encodeURIComponent('Re: your message via iamjkc.space')}`

  const inner = `
  ${wordmark()}
  <tr>
    <td style="background:${SURFACE};border:1px solid ${LINE};border-radius:4px;padding:36px 34px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 4px;font:600 10px/1.4 ${SANS};letter-spacing:0.18em;text-transform:uppercase;color:${ACCENT};">
            New enquiry
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 30px;font:400 27px/1.25 ${SERIF};color:${INK};letter-spacing:-0.01em;">
            ${escapeHtml(msg.name)} got in touch
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${field('From', escapeHtml(msg.name))}
        ${field(
          'Email',
          `<a href="mailto:${encodeURI(msg.email)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(msg.email)}</a>`,
        )}
      </table>

      <!-- The message gets its own surface so it reads as their words. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 8px;font:600 10px/1.4 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${FAINT};">
            Message
          </td>
        </tr>
        <tr>
          <td style="background:${QUOTE_BG};border-left:2px solid ${ACCENT};border-radius:0 3px 3px 0;padding:18px 20px;font:400 16px/1.6 ${SANS};color:${INK};">
            ${formatMessage(msg.message)}
          </td>
        </tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:30px 0 0;">
            <a href="${mailto}" style="display:inline-block;padding:14px 26px;background:${ACCENT};color:${BG};font:600 11px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:3px;">
              Reply to ${escapeHtml(firstName(msg.name))}
            </a>
          </td>
        </tr>
      </table>

    </td>
  </tr>
  <tr>
    <td style="padding:20px 4px 0;font:400 12px/1.6 ${SANS};color:${FAINT};">
      Received ${escapeHtml(msg.receivedAt)} &middot; archived in Netlify Forms.<br />
      Replying to this email goes straight to ${escapeHtml(firstName(msg.name))}.
    </td>
  </tr>`

  return shell(`${msg.name}: ${subjectSnippet(msg.message, 90)}`, inner)
}

export function renderContactText(msg: ContactMessage): string {
  return [
    'NEW ENQUIRY — iamjkc.space',
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
  const inner = `
  ${wordmark()}
  <tr>
    <td style="background:${SURFACE};border:1px solid ${LINE};border-radius:4px;padding:36px 34px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 20px;font:400 27px/1.25 ${SERIF};color:${INK};letter-spacing:-0.01em;">
            Thanks, ${escapeHtml(firstName(msg.name))}.
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 26px;font:400 16px/1.6 ${SANS};color:${MUTED};">
            Your message reached me and I'll reply personally, usually within a
            day or two. No action needed from you in the meantime.
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:0 0 8px;font:600 10px/1.4 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${FAINT};">
            What you sent
          </td>
        </tr>
        <tr>
          <td style="background:${QUOTE_BG};border-left:2px solid ${LINE};border-radius:0 3px 3px 0;padding:18px 20px;font:400 15px/1.6 ${SANS};color:${MUTED};">
            ${formatMessage(msg.message)}
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:30px 0 0;border-top:1px solid ${LINE};margin-top:30px;">
            <div style="padding-top:22px;font:400 15px/1.5 ${SANS};color:${INK};">
              Jan Kevin Cadampog
            </div>
            <div style="padding-top:3px;font:400 13px/1.5 ${SANS};color:${FAINT};">
              Software Engineer &middot; Cebu City
            </div>
            <div style="padding-top:12px;font:400 13px/1.5 ${SANS};">
              <a href="${msg.siteUrl}" style="color:${ACCENT};text-decoration:none;">iamjkc.space</a>
            </div>
          </td>
        </tr>
      </table>

    </td>
  </tr>
  <tr>
    <td style="padding:20px 4px 0;font:400 12px/1.6 ${SANS};color:${FAINT};">
      This is an automatic confirmation — but replying to it does reach me.
    </td>
  </tr>`

  return shell(
    `Thanks for getting in touch — I'll reply personally.`,
    inner,
  )
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
