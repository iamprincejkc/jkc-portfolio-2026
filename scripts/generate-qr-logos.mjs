/**
 * Generates `utils/qr/logos.ts` from simple-icons.
 *
 * The brand marks are baked into a committed source file rather than imported
 * at runtime: simple-icons ships ~3300 icons, and no bundler heuristic is
 * worth trusting to shake 3300 of them out of a portfolio bundle for the sake
 * of 26. Re-run with `node scripts/generate-qr-logos.mjs` to refresh.
 *
 * simple-icons data is CC0-1.0. The marks themselves remain the property of
 * their respective owners and are offered here only so a user can point a QR
 * code at their own profile on that service.
 */
import { writeFileSync } from 'node:fs'
import * as si from 'simple-icons'

// Order matters - this is the order the picker renders them in.
const WANTED = [
  'Facebook', 'YouTube', 'X', 'Instagram', 'TikTok',
  'Messenger', 'Apple', 'Discord', 'Dribbble', 'Figma',
  'GitHub', 'Google', 'Gmail', 'Medium', 'Pinterest',
  'Reddit', 'Signal', 'Snapchat', 'Spotify', 'Telegram',
  'Threads', 'Tumblr', 'Twitch', 'VK', 'WhatsApp',
  'Bluesky', 'Behance', 'Vimeo',
]

const byTitle = Object.create(null)
for (const icon of Object.values(si)) {
  if (icon && typeof icon === 'object' && 'title' in icon) byTitle[icon.title] = icon
}

const rows = WANTED.map((title) => {
  const icon = byTitle[title]
  if (!icon) throw new Error(`simple-icons has no icon titled "${title}"`)
  return { id: icon.slug, title, hex: `#${icon.hex}`, path: icon.path }
})

const body = rows
  .map(
    (r) => `  {
    id: '${r.id}',
    title: ${JSON.stringify(r.title)},
    hex: '${r.hex}',
    path: '${r.path}',
  },`,
  )
  .join('\n')

writeFileSync(
  new URL('../utils/qr/logos.ts', import.meta.url),
  `/**
 * Brand marks for the QR logo picker.
 *
 * GENERATED FILE - do not edit by hand.
 * Run \`node scripts/generate-qr-logos.mjs\` to regenerate from simple-icons.
 *
 * Every mark is a single path drawn inside a 24x24 viewBox, which is what lets
 * the same data be a vector logo in the SVG, PDF and EPS exports rather than a
 * rasterised stamp. Marks are CC0 path data (simple-icons); the brands remain
 * the property of their owners.
 *
 * LinkedIn is deliberately absent: simple-icons removed it at the trademark
 * holder's request, and re-drawing it here would walk straight back into the
 * reason it was removed. Users who want it can upload their own file.
 */

export interface BrandLogo {
  /** Stable slug, used in the shareable URL. */
  id: string
  title: string
  /** Official brand colour, offered as the "match logo colour" shortcut. */
  hex: string
  /** Path data in a 24x24 coordinate space. */
  path: string
}

export const BRAND_LOGOS: readonly BrandLogo[] = [
${body}
]

export function findBrandLogo(id: string): BrandLogo | undefined {
  return BRAND_LOGOS.find((logo) => logo.id === id)
}
`,
)

console.log(`wrote utils/qr/logos.ts with ${rows.length} marks`)
