/**
 * Round-trips the whole editor state through the URL.
 *
 * This is what makes "Copy link" mean something: the recipient opens the link
 * and sees the same code, not a blank generator. Keys are two characters
 * because the payload can already be a long vCard and browsers still have
 * practical URL length limits.
 *
 * An uploaded logo is deliberately not serialised. It would be a base64 image
 * in a query string, which is both enormous and a quiet way to leak a file to
 * anyone the link is forwarded to.
 */
import { defaultStyle, type GradientMode, type JoinMode, type QrStyle, type RotationMode } from './render'
import type { ErrorCorrection } from './matrix'
import { emptyContent, type ContentMode, type QrContent, type WifiSecurity } from './payload'

const HEX = /^#[0-9a-f]{6}$/i

function hex(value: string | null, fallback: string): string {
  if (!value) return fallback
  const withHash = value.startsWith('#') ? value : `#${value}`
  return HEX.test(withHash) ? withHash.toLowerCase() : fallback
}

function clamp(value: string | null, min: number, max: number, fallback: number): number {
  // `Number(null)` and `Number('')` are both 0, which would silently turn every
  // absent key into a zero rather than into its default.
  if (value === null || value.trim() === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function bool(value: string | null): boolean {
  return value === '1'
}

const JOINS: readonly JoinMode[] = ['none', 'horizontal', 'vertical', 'both']
const ROTATIONS: readonly RotationMode[] = ['none', 'random', 'spiral', 'radial', 'wave']
const GRADIENTS: readonly GradientMode[] = ['none', 'linear', 'radial']
const ECCS: readonly ErrorCorrection[] = ['L', 'M', 'Q', 'H']
const MODES: readonly ContentMode[] = ['url', 'wifi', 'event', 'contact']
const SECURITY: readonly WifiSecurity[] = ['WPA', 'WEP', 'nopass']

export function stateToQuery(style: QrStyle, content: QrContent): URLSearchParams {
  const q = new URLSearchParams()
  const base = defaultStyle()

  // Only non-default values go in, which keeps a lightly-customised code's
  // link short enough to paste into a chat window.
  const put = (key: string, value: string | number | boolean, fallback: string | number | boolean) => {
    if (value === fallback) return
    q.set(key, typeof value === 'boolean' ? '1' : String(value))
  }

  q.set('m', content.mode)
  switch (content.mode) {
    case 'url':
      if (content.url.text) q.set('d', content.url.text)
      break
    case 'wifi':
      if (content.wifi.ssid) q.set('ws', content.wifi.ssid)
      // The password is intentionally omitted; a Wi-Fi key does not belong in
      // a shareable URL that lands in browser history and referrer headers.
      put('wt', content.wifi.security, 'WPA')
      put('wh', content.wifi.hidden, false)
      break
    case 'event':
      if (content.event.title) q.set('et', content.event.title)
      if (content.event.location) q.set('el', content.event.location)
      if (content.event.start) q.set('es', content.event.start)
      if (content.event.end) q.set('ee', content.event.end)
      if (content.event.description) q.set('ed', content.event.description)
      break
    case 'contact':
      if (content.contact.firstName) q.set('cf', content.contact.firstName)
      if (content.contact.lastName) q.set('cl', content.contact.lastName)
      if (content.contact.organization) q.set('co', content.contact.organization)
      if (content.contact.jobTitle) q.set('cj', content.contact.jobTitle)
      if (content.contact.phone) q.set('cp', content.contact.phone)
      if (content.contact.email) q.set('ce', content.contact.email)
      if (content.contact.website) q.set('cw', content.contact.website)
      if (content.contact.address) q.set('ca', content.contact.address)
      break
  }

  put('ec', style.ecc, base.ecc)
  put('mg', style.margin, base.margin)
  put('bs', style.bodyShape, base.bodyShape)
  put('ef', style.eyeFrameShape, base.eyeFrameShape)
  put('ep', style.eyePupilShape, base.eyePupilShape)
  put('jn', style.join, base.join)
  put('th', style.thickness, base.thickness)
  put('cr', style.cornerRadius, base.cornerRadius)
  put('rt', style.rotation, base.rotation)
  put('rs', style.rotationStrength, base.rotationStrength)
  put('jt', style.jitter, base.jitter)
  put('sd', style.seed, base.seed)
  put('fg', style.foreground.replace('#', ''), base.foreground.replace('#', ''))
  put('bg', style.background.replace('#', ''), base.background.replace('#', ''))
  put('gr', style.gradient, base.gradient)
  put('g1', style.gradientStart.replace('#', ''), base.gradientStart.replace('#', ''))
  put('g2', style.gradientEnd.replace('#', ''), base.gradientEnd.replace('#', ''))
  put('ga', style.gradientAngle, base.gradientAngle)
  put('se', style.separateEyeColors, base.separateEyeColors)
  put('e1', style.eyeFrameColor.replace('#', ''), base.eyeFrameColor.replace('#', ''))
  put('e2', style.eyePupilColor.replace('#', ''), base.eyePupilColor.replace('#', ''))
  put('bo', style.bodyOutline, base.bodyOutline)
  put('bc', style.bodyOutlineColor.replace('#', ''), base.bodyOutlineColor.replace('#', ''))
  put('po', style.eyePupilOutline, base.eyePupilOutline)
  put('pc', style.eyePupilOutlineColor.replace('#', ''), base.eyePupilOutlineColor.replace('#', ''))
  if (style.logoId) q.set('lg', style.logoId)
  put('ls', style.logoSize, base.logoSize)
  put('lc', style.matchLogoColor, base.matchLogoColor)

  return q
}

export function queryToState(q: URLSearchParams): { style: QrStyle; content: QrContent } {
  const base = defaultStyle()
  const content = emptyContent()

  content.mode = oneOf(q.get('m'), MODES, 'url')
  content.url.text = q.get('d') ?? ''
  content.wifi.ssid = q.get('ws') ?? ''
  content.wifi.security = oneOf(q.get('wt'), SECURITY, 'WPA')
  content.wifi.hidden = bool(q.get('wh'))
  content.event.title = q.get('et') ?? ''
  content.event.location = q.get('el') ?? ''
  content.event.start = q.get('es') ?? ''
  content.event.end = q.get('ee') ?? ''
  content.event.description = q.get('ed') ?? ''
  content.contact.firstName = q.get('cf') ?? ''
  content.contact.lastName = q.get('cl') ?? ''
  content.contact.organization = q.get('co') ?? ''
  content.contact.jobTitle = q.get('cj') ?? ''
  content.contact.phone = q.get('cp') ?? ''
  content.contact.email = q.get('ce') ?? ''
  content.contact.website = q.get('cw') ?? ''
  content.contact.address = q.get('ca') ?? ''

  const style: QrStyle = {
    ...base,
    ecc: oneOf(q.get('ec'), ECCS, base.ecc),
    margin: clamp(q.get('mg'), 0, 10, base.margin),
    bodyShape: q.get('bs') ?? base.bodyShape,
    eyeFrameShape: q.get('ef') ?? base.eyeFrameShape,
    eyePupilShape: q.get('ep') ?? base.eyePupilShape,
    join: oneOf(q.get('jn'), JOINS, base.join),
    thickness: clamp(q.get('th'), 0.4, 1, base.thickness),
    cornerRadius: clamp(q.get('cr'), 0, 1, base.cornerRadius),
    rotation: oneOf(q.get('rt'), ROTATIONS, base.rotation),
    rotationStrength: clamp(q.get('rs'), 0, 1, base.rotationStrength),
    jitter: clamp(q.get('jt'), 0, 1, base.jitter),
    seed: clamp(q.get('sd'), 0, 2 ** 31, base.seed),
    foreground: hex(q.get('fg'), base.foreground),
    background: hex(q.get('bg'), base.background),
    gradient: oneOf(q.get('gr'), GRADIENTS, base.gradient),
    gradientStart: hex(q.get('g1'), base.gradientStart),
    gradientEnd: hex(q.get('g2'), base.gradientEnd),
    gradientAngle: clamp(q.get('ga'), 0, 360, base.gradientAngle),
    separateEyeColors: bool(q.get('se')),
    eyeFrameColor: hex(q.get('e1'), base.eyeFrameColor),
    eyePupilColor: hex(q.get('e2'), base.eyePupilColor),
    bodyOutline: bool(q.get('bo')),
    bodyOutlineColor: hex(q.get('bc'), base.bodyOutlineColor),
    eyePupilOutline: bool(q.get('po')),
    eyePupilOutlineColor: hex(q.get('pc'), base.eyePupilOutlineColor),
    logoId: q.get('lg'),
    logoDataUrl: null,
    logoSize: clamp(q.get('ls'), 0.08, 0.32, base.logoSize),
    matchLogoColor: bool(q.get('lc')),
  }

  return { style, content }
}
