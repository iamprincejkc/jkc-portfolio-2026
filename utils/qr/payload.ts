/**
 * Turns the four content modes into the string that actually gets encoded.
 *
 * Every mode here is a de-facto standard that phone cameras recognise without
 * an app: plain text/URL, the WIFI: scheme Android and iOS both parse, vCard
 * 3.0 for contacts, and a bare VEVENT for calendar entries. None of them are
 * ours to invent, so the escaping rules below are the interesting part.
 */

export type ContentMode = 'url' | 'wifi' | 'event' | 'contact'

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass'

export interface UrlContent {
  text: string
}

export interface WifiContent {
  ssid: string
  password: string
  security: WifiSecurity
  hidden: boolean
}

export interface EventContent {
  title: string
  location: string
  /** `YYYY-MM-DDTHH:mm`, as produced by `<input type="datetime-local">`. */
  start: string
  end: string
  description: string
}

export interface ContactContent {
  firstName: string
  lastName: string
  organization: string
  jobTitle: string
  phone: string
  email: string
  website: string
  address: string
}

export interface QrContent {
  mode: ContentMode
  url: UrlContent
  wifi: WifiContent
  event: EventContent
  contact: ContactContent
}

export function emptyContent(): QrContent {
  return {
    mode: 'url',
    url: { text: '' },
    wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
    event: { title: '', location: '', start: '', end: '', description: '' },
    contact: {
      firstName: '',
      lastName: '',
      organization: '',
      jobTitle: '',
      phone: '',
      email: '',
      website: '',
      address: '',
    },
  }
}

/**
 * WIFI: is a semicolon-delimited field list, so a semicolon inside an SSID or
 * password has to be escaped or the parser silently truncates the network
 * name. Backslash, comma, colon and double-quote are escaped for the same
 * reason.
 */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

/**
 * vCard and iCalendar both fold on CRLF and treat comma, semicolon and
 * backslash as structural. Newlines inside a value become the literal `\n`
 * sequence rather than a real line break.
 */
function escapeICal(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** `2026-08-29T14:30` -> `20260829T143000`. Empty input yields empty output. */
function toICalLocalTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return ''
  const [, y, m, d, hh, mm] = match
  return `${y}${m}${d}T${hh}${mm}00`
}

/**
 * A URL typed without a scheme is still meant as a URL. Anything that looks
 * like a bare domain gets https:// so the camera offers to open it rather than
 * showing a wall of text; anything else is left exactly as typed.
 */
function normaliseUrlish(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#)/i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function buildPayload(content: QrContent): string {
  switch (content.mode) {
    case 'url':
      return normaliseUrlish(content.url.text)

    case 'wifi': {
      const { ssid, password, security, hidden } = content.wifi
      if (!ssid.trim()) return ''
      const parts = [`T:${security}`, `S:${escapeWifi(ssid)}`]
      // An open network must not carry a P: field at all; some scanners then
      // prompt for a password that does not exist.
      if (security !== 'nopass' && password) parts.push(`P:${escapeWifi(password)}`)
      if (hidden) parts.push('H:true')
      return `WIFI:${parts.join(';')};;`
    }

    case 'event': {
      const { title, location, start, end, description } = content.event
      if (!title.trim() && !start) return ''
      const lines = ['BEGIN:VEVENT']
      if (title.trim()) lines.push(`SUMMARY:${escapeICal(title.trim())}`)
      if (location.trim()) lines.push(`LOCATION:${escapeICal(location.trim())}`)
      if (description.trim()) lines.push(`DESCRIPTION:${escapeICal(description.trim())}`)
      const dtStart = toICalLocalTime(start)
      const dtEnd = toICalLocalTime(end)
      if (dtStart) lines.push(`DTSTART:${dtStart}`)
      if (dtEnd) lines.push(`DTEND:${dtEnd}`)
      lines.push('END:VEVENT')
      return lines.join('\n')
    }

    case 'contact': {
      const c = content.contact
      const name = `${c.firstName} ${c.lastName}`.trim()
      if (!name && !c.organization.trim() && !c.phone.trim() && !c.email.trim()) return ''
      const lines = ['BEGIN:VCARD', 'VERSION:3.0']
      lines.push(`N:${escapeICal(c.lastName.trim())};${escapeICal(c.firstName.trim())};;;`)
      if (name) lines.push(`FN:${escapeICal(name)}`)
      if (c.organization.trim()) lines.push(`ORG:${escapeICal(c.organization.trim())}`)
      if (c.jobTitle.trim()) lines.push(`TITLE:${escapeICal(c.jobTitle.trim())}`)
      if (c.phone.trim()) lines.push(`TEL;TYPE=CELL:${escapeICal(c.phone.trim())}`)
      if (c.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${escapeICal(c.email.trim())}`)
      if (c.website.trim()) lines.push(`URL:${escapeICal(normaliseUrlish(c.website))}`)
      // ADR is a 7-part field; the free-text box maps to the street slot.
      if (c.address.trim()) lines.push(`ADR;TYPE=HOME:;;${escapeICal(c.address.trim())};;;;`)
      lines.push('END:VCARD')
      return lines.join('\n')
    }
  }
}

/** What the preview shows before the user has typed anything real. */
export const PLACEHOLDER_PAYLOAD = 'https://iamjkc.space'
