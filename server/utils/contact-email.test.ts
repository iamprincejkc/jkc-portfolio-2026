import { describe, expect, it } from 'vitest'
import {
  firstName,
  formatReceived,
  renderAutoReply,
  renderContactEmail,
  renderContactText,
  siteHost,
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
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img ')
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
    expect(html).toContain('Thanks, Ada.')
    expect(html).toContain('Hello there')
  })

  it('does not leak the recipient address into the auto-reply body', () => {
    // The confirmation goes to a stranger; JKC's own inbox address should not
    // be printed in it.
    const html = renderAutoReply(base)
    expect(html).not.toContain('nogame1697')
  })
})
