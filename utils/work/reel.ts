/**
 * The selected-work reel: every project as a short screen recording.
 *
 * The clips live in /public/videos/work and are made by recording each site in
 * headless Chrome - smooth scripted scrolls and clicks, captured from the
 * page's own paint frames - then encoded to H.264 at 1280x800 and 720x450.
 * Where there was nothing public to film, the clip is a slow camera move across
 * the one image that exists, and `filmed` says so.
 *
 * `duration` is the clip's real runtime in seconds. The timeline under the
 * reel adds them up, so the timecode it shows is the length of the actual
 * footage rather than a made-up number.
 */

export interface WorkClip {
  /** Base name in /videos/work: `<name>.mp4`, `<name>-m.mp4`, `<name>.webp`. */
  name: string
  duration: number
}

export interface Work {
  slug: string
  name: string
  /** What the name stands for, set smaller under it - `3QV` is Three-Quarter View. */
  aka?: string
  /** A shorter label for tight spaces - the timeline, the address bar. */
  short: string
  category: string
  year: string
  /** Honest about whether it was built, maintained or contributed to. */
  role: string
  blurb: string
  stack: string[]
  /** Public link. Absent for internal work, which renders unlinked. */
  url?: string
  /** The link's text, when "Visit <short>" would not say where it goes. */
  cta?: string
  /** What the browser frame's address bar shows. */
  host: string
  /** `live` was recorded on the real site; `still` is a camera move over an image. */
  filmed: 'live' | 'demo' | 'still'
  clip: WorkClip
  /** The project's own brand colour, used for the glow behind its screen. */
  tint: string
}

export const WORK: Work[] = [
  {
    slug: 'capital-financial',
    name: 'Capital Financial Services',
    short: 'Capital Financial',
    category: 'Website · Finance',
    year: '2026',
    role: 'Built',
    blurb:
      'Car, bike, boat and caravan finance for New Zealanders. A fast, plain-spoken site with a live repayment calculator up front, guides, FAQs and an enquiry flow behind it.',
    stack: ['Astro', 'TypeScript', 'Tailwind CSS', 'AWS'],
    url: 'https://capitalfinancialservices.co.nz/',
    host: 'capitalfinancialservices.co.nz',
    filmed: 'live',
    clip: { name: 'cfs', duration: 19.8 },
    tint: '#2563eb',
  },
  {
    slug: '360fs',
    name: '360°FS',
    aka: '360° Frame Surround',
    short: '360°FS',
    category: 'JavaScript Plugin · Automotive',
    year: '2025',
    role: 'Built',
    blurb:
      'A drop-in web component that spins a vehicle through 144 studio frames at three camera heights, then steps inside to a full interior panorama. Drag, keys and zoom; one script, no conflicts.',
    stack: ['JavaScript', 'Web Components', 'Pannellum', 'Terser'],
    url: 'https://jetlogistics.co.jp/en/services',
    cta: 'See it on Jet Logistics',
    host: 'widget-360 · demo vehicle',
    filmed: 'demo',
    clip: { name: 'fs360', duration: 24.1 },
    tint: '#dc2626',
  },
  {
    slug: '3qv',
    name: '3QV',
    aka: 'Three-Quarter View',
    short: '3QV',
    category: 'JavaScript Plugin · Automotive',
    year: '2025',
    role: 'Built',
    blurb:
      'The industry-standard three-quarter "hero" angles as a full-screen card-swap carousel - swipe, keyboard and dot navigation, preloading, and every photo in one ZIP. Built for Jet Logistics and IBC Auto.',
    stack: ['JavaScript', 'Web Components', 'JSZip'],
    url: 'https://jetlogistics.co.jp/en/services',
    cta: 'See it on Jet Logistics',
    host: 'widget-3qv · card-swap build',
    filmed: 'demo',
    clip: { name: 'qv3', duration: 14.6 },
    tint: '#f78a1c',
  },
  {
    slug: 'ibc-auto',
    name: 'IBC Auto',
    short: 'IBC Auto',
    category: 'Web Platform · Auto Marketplace',
    year: '2024',
    role: 'Built · Maintained',
    blurb:
      'A Japanese used-car export marketplace: stock search across 100,000+ vehicles, auctions, and the vehicle pages the 360°FS and 3QV widgets plug into.',
    stack: ['.NET', 'C#', 'JavaScript'],
    url: 'https://ibcauto.com/search',
    host: 'ibcauto.com',
    filmed: 'still',
    clip: { name: 'ibc', duration: 9.0 },
    tint: '#ef4444',
  },
  {
    slug: 'jet-logistics',
    name: 'Jet Logistics',
    short: 'Jet Logistics',
    category: 'Corporate Site · Logistics',
    year: '2024',
    role: 'Maintained',
    blurb:
      'Vehicle shipping and customs handling out of Kobe - live shipping schedules, the DX services catalogue, and quote requests.',
    stack: ['C#', 'ASP.NET', 'Tailwind CSS'],
    url: 'https://www.jetlogistics.co.jp/',
    host: 'jetlogistics.co.jp',
    filmed: 'live',
    clip: { name: 'jet', duration: 16.0 },
    tint: '#ff8f3e',
  },
  {
    slug: 'gis',
    name: 'Global Inspection Specialists',
    short: 'GIS',
    category: 'Web Platform · Compliance',
    year: '2024',
    role: 'Built · Maintained',
    blurb:
      'Vehicle, vessel and heavy-equipment inspection under ISO 17020, with live certificate verification for governments and buyers checking a car before it ships.',
    stack: ['ASP.NET', 'C#', 'IIS'],
    url: 'https://globalinspectionspecialist.com/',
    host: 'globalinspectionspecialist.com',
    filmed: 'live',
    clip: { name: 'gis', duration: 18.5 },
    tint: '#f5c242',
  },
  {
    slug: 'hope-lifemark',
    name: 'HOPE LifeMark-HX',
    short: 'HOPE LifeMark-HX',
    category: 'Enterprise EMR · Healthcare',
    year: '2023',
    role: 'Contributed · Supported',
    blurb:
      "Fujitsu's electronic medical record system for hospitals. Development, testing, production support and change requests on critical releases.",
    stack: ['Enterprise', 'Healthcare', 'Testing'],
    host: 'Internal · Fujitsu',
    filmed: 'still',
    clip: { name: 'hope', duration: 9.0 },
    tint: '#3b82f6',
  },
  {
    slug: 'rd-pawnshop',
    name: 'RD Pawnshop System',
    short: 'RD Pawnshop',
    category: 'Internal Tools · .NET MVC',
    year: '2022',
    role: 'Built · Maintained',
    blurb:
      '.NET MVC applications on SQL Server for a pawnshop and jewelry chain - internal tooling, code reviews, and features shipped with Git.',
    stack: ['.NET MVC', 'C#', 'SQL Server'],
    host: 'Internal · RD Pawnshop',
    filmed: 'still',
    clip: { name: 'rd', duration: 9.0 },
    tint: '#e11d48',
  },
]

/** The showreel that opens the section: two seconds of each project. */
export const REEL: WorkClip = { name: 'reel', duration: 12.8 }

export const clipSrc = (clip: WorkClip, mobile = false) =>
  `/videos/work/${clip.name}${mobile ? '-m' : ''}.mp4`

export const clipPoster = (clip: WorkClip) => `/videos/work/${clip.name}.webp`

/** `83.4` -> `01:23`. */
export function timecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Where a scroll position lands in the reel: which chapter, and how far into
 * the whole runtime. `progress` is 0..1 across all chapters, each chapter
 * taking an equal share of the scroll, as the page lays them out.
 */
export function playhead(progress: number, durations: number[]) {
  const n = durations.length
  const p = Math.min(1, Math.max(0, progress))
  const index = Math.min(n - 1, Math.floor(p * n))
  const within = p * n - index
  const before = durations.slice(0, index).reduce((a, b) => a + b, 0)
  return { index, within, seconds: before + within * durations[index]! }
}
