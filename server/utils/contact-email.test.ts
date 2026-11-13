import { describe, expect, it } from 'vitest'
import {
  RESEND_TEST_SENDER,
  fallbackSender,
  firstName,
  formatReceived,
  isUnverifiedDomain,
  renderAutoReply,
  renderContactEmail,
  renderContactText,
  siteHost,
  telHref,
  withSenderName,
  autoReplySubject,
  renderAutoReplyText,
  subjectSnippet,
  type ContactMessage,
} from './contact-email'

const base: ContactMessage = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello there',
  receivedAt: 'Sat, 15 Aug, 08:32 pm',
  siteUrl: 'https://iamjkc.space',
}

describe('site host', () => {
  const moved: ContactMessage = { ...base, siteUrl: 'https://example.dev' }

  it('takes the host from the configured site URL, not from the template', () => {
    // The point of the whole exercise: moving to a new domain is one
    // environment variable, not a hunt through an email template.
    for (const html of [renderContactEmail(moved), renderAutoReply(moved)]) {
      expect(html).toContain('example.dev')
      expect(html).not.toContain('iamjkc.space')
    }
    expect(renderContactText(moved)).toContain('example.dev')
  })

  it('brands the reply subject with the current host', () => {
    expect(renderContactEmail(moved)).toContain('Re%3A%20your%20message%20via%20example.dev')
  })

  it('survives a site URL that is not a valid URL', () => {
    // A misconfigured NUXT_PUBLIC_SITE_URL must not take the contact form
    // down - the message still has to get through.
    expect(siteHost('not a url')).toBe('not a url')
    expect(siteHost('')).toBe('')
    expect(() => renderContactEmail({ ...base, siteUrl: 'nonsense' })).not.toThrow()
  })

  it('drops the scheme and any path', () => {
    expect(siteHost('https://iamprincejkc.netlify.app/')).toBe('iamprincejkc.netlify.app')
    expect(siteHost('https://example.dev/a/b?c=1')).toBe('example.dev')
  })
})

describe('escaping', () => {
  it('escapes HTML in every field the sender controls', () => {
    // The sender writes these. Unescaped, a message is a script injection into
    // JKC's mail client.
    const hostile: ContactMessage = {
      ...base,
      name: '<script>alert(1)</script>',
      message: '<img src=x onerror=alert(1)>',
    }
    const html = renderContactEmail(hostile)

    // What matters is that no sender-supplied tag survives as a tag. The text
    // "onerror=" may well appear escaped in the body - inert, because the
    // angle brackets around it are entities, so it is never an attribute.
    // The email has its own <img> tags (logo, photo), so look for the injected one.
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toMatch(/<img[^>]*onerror/)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('escapes the sender name in the auto-reply too', () => {
    const html = renderAutoReply({ ...base, name: '<b>Mallory</b>' })
    expect(html).not.toContain('<b>Mallory</b>')
    expect(html).toContain('&lt;b&gt;')
  })

  it('turns newlines into breaks rather than losing them', () => {
    const html = renderContactEmail({ ...base, message: 'one\ntwo' })
    expect(html).toContain('one<br />two')
  })

  it('keeps the plain-text part unescaped and readable', () => {
    // Plain text must not carry HTML entities - it is read as-is.
    const text = renderContactText({ ...base, message: 'a & b' })
    expect(text).toContain('a & b')
    expect(text).not.toContain('&amp;')
  })
})

describe('subjectSnippet', () => {
  it('passes short messages through unchanged', () => {
    expect(subjectSnippet('Short one')).toBe('Short one')
  })

  it('collapses whitespace so the subject stays on one line', () => {
    expect(subjectSnippet('two\n\nlines   here')).toBe('two lines here')
  })

  it('truncates long messages with an ellipsis', () => {
    const out = subjectSnippet('x'.repeat(200), 20)
    expect(out).toHaveLength(20)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('Ada Lovelace')).toBe('Ada')
  })

  it('falls back to something neutral when empty', () => {
    expect(firstName('   ')).toBe('there')
  })
})

describe('formatReceived', () => {
  it('renders in the given timezone, not UTC', () => {
    // 12:32 UTC is 20:32 in Manila. Showing GMT was the original complaint.
    const formatted = formatReceived(new Date('2026-08-15T12:32:13Z'), 'Asia/Manila')
    expect(formatted).toMatch(/08:32/)
    expect(formatted).toMatch(/pm/i)
  })

  it('falls back rather than throwing on a bad timezone', () => {
    const formatted = formatReceived(new Date('2026-08-15T12:32:13Z'), 'Not/AZone')
    expect(formatted).toContain('2026')
  })
})

describe('structure', () => {
  it('sets reply guidance and the sender name in the notification', () => {
    const html = renderContactEmail(base)
    expect(html).toContain('Reply to Ada')
    expect(html).toContain('ada@example.com')
  })

  it('quotes the message back in the auto-reply', () => {
    const html = renderAutoReply(base)
    expect(html).toContain('Thanks for reaching out, <span')
    expect(html).toContain('Ada.</span>')
    expect(html).toContain('Hello there')
  })

  it('names the site the message was sent from', () => {
    // A message from the Cloudflare copy must not be labelled as Netlify.
    const html = renderContactEmail({ ...base, siteUrl: 'https://iamprincejkc.pages.dev' })
    expect(html).toContain('Sent from the contact form on')
    expect(html).toContain('iamprincejkc.pages.dev')
    expect(html).not.toContain('netlify')
  })

  it('declares itself light-only', () => {
    for (const html of [renderContactEmail(base), renderAutoReply(base)]) {
      expect(html).toContain('<meta name="color-scheme" content="light" />')
    }
  })

  it('does not leak the recipient address into the auto-reply body', () => {
    // The confirmation goes to a stranger; JKC's own inbox address should not
    // be printed in it.
    const html = renderAutoReply(base)
    expect(html).not.toContain('nogame1697')
  })
})

describe('lapsed sending domain', () => {
  // The shape ofetch throws: status on the error, Resend's JSON body in `data`.
  const resendError = (statusCode: number, message: string) => ({
    statusCode,
    data: { statusCode, name: 'validation_error', message },
  })

  it('recognises Resend refusing an unverified domain', () => {
    const lapsed = resendError(
      403,
      'The iamjkc.space domain is not verified. Please, add and verify your domain on https://resend.com/domains',
    )
    expect(isUnverifiedDomain(lapsed)).toBe(true)
  })

  it('leaves every other refusal alone, so it still fails loudly', () => {
    // A bad key or the shared sender's own limit must not be rerouted.
    expect(isUnverifiedDomain(resendError(401, 'API key is invalid'))).toBe(false)
    expect(
      isUnverifiedDomain(resendError(403, 'You can only send testing emails to your own email address (a@b.c).')),
    ).toBe(false)
    expect(isUnverifiedDomain(new Error('fetch failed'))).toBe(false)
    expect(isUnverifiedDomain(null)).toBe(false)
  })

  it('keeps the display name and swaps only the address', () => {
    expect(fallbackSender('JKC <hello@iamjkc.space>')).toBe(`JKC <${RESEND_TEST_SENDER}>`)
    expect(fallbackSender('"Jan Kevin" <hi@iamjkc.space>')).toBe(`"Jan Kevin" <${RESEND_TEST_SENDER}>`)
    // A bare address gets a name, so the inbox does not just say "onboarding".
    expect(fallbackSender('hello@iamjkc.space')).toBe(`Portfolio contact <${RESEND_TEST_SENDER}>`)
  })
})

describe('business enquiries', () => {
  it('shows the business and phone when they are given', () => {
    const msg = { ...base, business: 'Smile Dental Mandaue', phone: '0917 123 4567' }
    const html = renderContactEmail(msg)
    expect(html).toContain('Smile Dental Mandaue')
    expect(html).toContain('href="tel:09171234567"')
    const text = renderContactText(msg)
    expect(text).toContain('Business: Smile Dental Mandaue')
    expect(text).toContain('Phone:    0917 123 4567')
  })

  it('offers a call instead of a reply when there is no email', () => {
    const html = renderContactEmail({ ...base, email: '', phone: '+63 917 123 4567' })
    expect(html).toContain('Call Ada')
    expect(html).toContain('href="tel:+639171234567"')
    expect(html).not.toContain('Reply to Ada')
    expect(html).not.toContain('mailto:')
    expect(renderContactText({ ...base, email: '', phone: '0917' })).not.toContain('Email:')
  })

  it('leaves out the rows nobody filled in', () => {
    const html = renderContactEmail(base)
    expect(html).not.toContain('>Business<')
    expect(html).not.toContain('>Phone<')
  })

  it('dials whatever spacing and dashes were typed', () => {
    expect(telHref('0917-123-4567')).toBe('tel:09171234567')
    expect(telHref(' +63 (917) 123 4567 ')).toBe('tel:+639171234567')
  })

  it('signs the confirmation as a Senior Software Engineer', () => {
    expect(renderAutoReply(base)).toContain('Senior Software Engineer')
  })
})

describe('branding', () => {
  it('sends under a person, not a bare address', () => {
    expect(withSenderName('contact@iamjkc.space')).toBe('Jan Kevin Cadampog <contact@iamjkc.space>')
    expect(withSenderName('JKC <contact@iamjkc.space>')).toBe('JKC <contact@iamjkc.space>')
    expect(withSenderName('')).toBe('')
  })

  it('greets by first name in the confirmation subject', () => {
    expect(autoReplySubject('Ada Lovelace')).toBe('Thanks for your message, Ada')
  })

  it('loads the logo and photo from the site the message came from, as PNG and JPEG', () => {
    const html = renderAutoReply({ ...base, siteUrl: 'https://example.dev' })
    expect(html).toContain('src="https://example.dev/icon-192.png"')
    expect(html).toContain('src="https://example.dev/images/email/headshot.jpg"')
    expect(html).not.toMatch(/\.(webp|svg)"/)
  })

  it('tags the link to the work so GA4 can attribute the visit', () => {
    const html = renderAutoReply(base)
    expect(html).toContain('utm_source=contact_auto_reply')
    expect(renderAutoReplyText(base)).toContain('utm_medium=email')
  })

  it('says what happens next, in both parts', () => {
    expect(renderAutoReply(base)).toContain('What happens next')
    expect(renderAutoReplyText(base)).toContain('1. I look at your business.')
  })

  it('names the business in the notification headline when there is one', () => {
    expect(renderContactEmail({ ...base, business: 'Smile Dental' })).toContain('from</span> Smile Dental')
  })

  it('never uses an em dash in any part', () => {
    for (const out of [renderContactEmail(base), renderContactText(base), renderAutoReply(base), renderAutoReplyText(base)]) {
      expect(out).not.toContain('\u2014')
    }
  })
})
