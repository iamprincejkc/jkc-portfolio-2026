/**
 * The HTML for the contact notification email.
 *
 * Email clients are not browsers: no external stylesheets, no custom fonts, no
 * flexbox or grid worth relying on. Everything here is inline styles on a table
 * layout, which is the only thing Outlook renders predictably.
 *
 * `prefers-color-scheme` is honoured where supported, but the palette is
 * committed to explicitly so a client that ignores it still gets the intended
 * look rather than black text on a black background.
 */

const INK = '#fafafa'
const MUTED = '#8c8c8c'
const BG = '#0a0a0a'
const SURFACE = '#141414'
const ACCENT = '#e8d4a0'
const LINE = 'rgba(118,118,118,0.28)'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Preserve the sender's paragraph breaks without letting their markup through. */
function formatMessage(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br />')
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:0 0 4px;font:500 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED};">
        ${escapeHtml(label)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 22px;font:400 16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
        ${value}
      </td>
    </tr>`
}

export type ContactMessage = {
  name: string
  email: string
  message: string
  receivedAt: string
  siteUrl: string
}

export function renderContactEmail(msg: ContactMessage): string {
  const emailLink = `<a href="mailto:${encodeURI(msg.email)}" style="color:${ACCENT};text-decoration:none;border-bottom:1px solid ${LINE};">${escapeHtml(msg.email)}</a>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>New message</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <!-- Preheader: the grey preview line in the inbox list. Hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(msg.name)} sent a message via iamjkc.space
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 0 20px;font:500 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.01em;color:${INK};">
              JKC<span style="color:${MUTED};"> — iamjkc.space</span>
            </td>
          </tr>

          <tr>
            <td style="background:${SURFACE};border:1px solid ${LINE};border-radius:3px;padding:32px;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 0 26px;font:400 24px/1.2 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-0.02em;">
                    New message from the site
                  </td>
                </tr>
                ${row('From', escapeHtml(msg.name))}
                ${row('Email', emailLink)}
                ${row('Message', formatMessage(msg.message))}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:8px 0 0;border-top:1px solid ${LINE};">
                    <a href="mailto:${encodeURI(msg.email)}?subject=${encodeURIComponent(`Re: your message via iamjkc.space`)}"
                       style="display:inline-block;margin-top:20px;padding:12px 22px;background:${ACCENT};color:${BG};font:500 11px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:2px;">
                      Reply to ${escapeHtml(msg.name.split(' ')[0] || 'them')}
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="padding:18px 2px 0;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${MUTED};">
              Received ${escapeHtml(msg.receivedAt)} · Stored in Netlify Forms.
              Hitting reply goes straight to the sender.
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Plain-text alternative. Some clients prefer it, and spam filters expect it. */
export function renderContactText(msg: ContactMessage): string {
  return [
    `New message from iamjkc.space`,
    ``,
    `From:    ${msg.name}`,
    `Email:   ${msg.email}`,
    ``,
    `Message:`,
    msg.message,
    ``,
    `--`,
    `Received ${msg.receivedAt}. Reply directly to reach the sender.`,
  ].join('\n')
}
