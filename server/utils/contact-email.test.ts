import { describe, expect, it } from 'vitest'
import {
  firstName,
  formatReceived,
  renderAutoReply,
  renderContactEmail,
  renderContactText,
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
