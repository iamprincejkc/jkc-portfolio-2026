import { describe, expect, it } from 'vitest'
import { buildPayload, emptyContent } from './payload'

function withUrl(text: string) {
  const c = emptyContent()
  c.mode = 'url'
  c.url.text = text
  return c
}

describe('url mode', () => {
  it('leaves an explicit scheme alone', () => {
    expect(buildPayload(withUrl('mailto:hi@example.com'))).toBe('mailto:hi@example.com')
    expect(buildPayload(withUrl('http://example.com'))).toBe('http://example.com')
  })

  it('adds https to a bare domain', () => {
    expect(buildPayload(withUrl('iamjkc.space'))).toBe('https://iamjkc.space')
    expect(buildPayload(withUrl('www.example.co.uk/path'))).toBe('https://www.example.co.uk/path')
  })

  it('leaves prose as prose', () => {
    expect(buildPayload(withUrl('meet me at 8'))).toBe('meet me at 8')
  })

  it('is empty until something is typed', () => {
    expect(buildPayload(withUrl('   '))).toBe('')
  })
})

describe('wifi mode', () => {
  function wifi(over: Partial<ReturnType<typeof emptyContent>['wifi']>) {
    const c = emptyContent()
    c.mode = 'wifi'
    Object.assign(c.wifi, { ssid: 'Net', password: 'pw', security: 'WPA' }, over)
    return buildPayload(c)
  }

  it('builds the standard field list', () => {
    expect(wifi({})).toBe('WIFI:T:WPA;S:Net;P:pw;;')
  })

  it('escapes the delimiters, or the SSID gets truncated by the scanner', () => {
    expect(wifi({ ssid: 'Guest;Wi-Fi', password: 'a:b,c\\d' })).toBe(
      'WIFI:T:WPA;S:Guest\\;Wi-Fi;P:a\\:b\\,c\\\\d;;',
    )
  })

  it('omits the password field entirely on an open network', () => {
    expect(wifi({ security: 'nopass' })).toBe('WIFI:T:nopass;S:Net;;')
  })

  it('flags a hidden network', () => {
    expect(wifi({ hidden: true })).toBe('WIFI:T:WPA;S:Net;P:pw;H:true;;')
  })

  it('produces nothing without an SSID', () => {
    expect(wifi({ ssid: '' })).toBe('')
  })
})

describe('event mode', () => {
  it('converts datetime-local values to iCalendar local time', () => {
    const c = emptyContent()
    c.mode = 'event'
    Object.assign(c.event, {
      title: 'Launch',
      location: 'Manila, PH',
      start: '2026-09-01T09:30',
      end: '2026-09-01T11:00',
    })
    expect(buildPayload(c)).toBe(
      [
        'BEGIN:VEVENT',
        'SUMMARY:Launch',
        'LOCATION:Manila\\, PH',
        'DTSTART:20260901T093000',
        'DTEND:20260901T110000',
        'END:VEVENT',
      ].join('\n'),
    )
  })

  it('turns real newlines into the escaped form', () => {
    const c = emptyContent()
    c.mode = 'event'
    c.event.title = 'Standup'
    c.event.description = 'line one\nline two'
    expect(buildPayload(c)).toContain('DESCRIPTION:line one\\nline two')
  })
})

describe('contact mode', () => {
  it('builds a vCard 3.0 with the structured name first', () => {
    const c = emptyContent()
    c.mode = 'contact'
    Object.assign(c.contact, {
      firstName: 'Jan Kevin',
      lastName: 'Cadampog',
      organization: 'Freelance',
      email: 'hi@example.com',
      website: 'iamjkc.space',
    })
    const out = buildPayload(c)
    expect(out.startsWith('BEGIN:VCARD\nVERSION:3.0\nN:Cadampog;Jan Kevin;;;')).toBe(true)
    expect(out).toContain('FN:Jan Kevin Cadampog')
    expect(out).toContain('URL:https://iamjkc.space')
    expect(out.endsWith('END:VCARD')).toBe(true)
  })

  it('produces nothing when every identifying field is blank', () => {
    const c = emptyContent()
    c.mode = 'contact'
    c.contact.website = 'example.com'
    expect(buildPayload(c)).toBe('')
  })
})
