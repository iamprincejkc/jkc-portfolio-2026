/**
 * Everything the business landing page (`/`) says, in one place.
 *
 * The page is for small business owners, most of whom arrive from a cold
 * email and have only a Facebook page today. So the copy is plain and in the
 * first person: it is one engineer, not an agency.
 *
 * House rules for anything written here:
 * - No em dashes. A plain hyphen, or a full stop.
 * - No prices. Every job is quoted, and the quote is negotiable.
 * - JKC's title is Senior Software Engineer, never "web designer".
 * - No service area. The first clients are in Cebu but the offer is for
 *   anyone, anywhere; JKC being based in Cebu City is a fact about him, not a
 *   limit on who he works with.
 */

/**
 * How people reach JKC. A channel left empty is simply not shown, so adding a
 * phone or Messenger link later is one line here and nothing else.
 */
export const CONTACT = {
  /** Shown as text. */
  email: 'jankevin.dev@gmail.com',
  /** What the link actually opens: the +site tag sorts replies in Gmail. */
  emailHref: 'mailto:jankevin.dev+site@gmail.com?subject=Website%20for%20my%20business',
  /** Display form, e.g. '0917 123 4567'. Empty: hidden. */
  phone: '',
  /** International digits only, e.g. '639171234567'. Used for tel: and wa.me. */
  phoneIntl: '',
  /** Facebook username or page for an m.me link. Empty: hidden. */
  messenger: '',
  linkedin: 'https://ph.linkedin.com/in/iamprincejkc',
  github: 'https://github.com/iamprincejkc',
} as const

/** Where JKC is based. Shown as a fact about him, never as a service area. */
export const BASE = { city: 'Cebu City', country: 'Philippines', countryCode: 'PH' } as const

export interface Problem {
  title: string
  body: string
}

export const PROBLEMS: Problem[] = [
  {
    title: 'Your Facebook page is your only website',
    body: 'Your hours, prices and best photos are buried under months of posts. When someone searches Google for "dentist near me", a Facebook page rarely shows up first.',
  },
  {
    title: 'Your website is old, slow or "Not secure"',
    body: 'Chrome warns people away from sites without HTTPS. A page that takes ten seconds on mobile data, or breaks on a phone, loses the customer before they read a word.',
  },
  {
    title: 'You answer the same questions all day',
    body: '"How much?" "Are you open today?" "Where are you?" One clear page answers them before anyone has to ask, and sends the serious ones straight to your Messenger.',
  },
]

export type ServiceIcon = 'layout' | 'messenger' | 'calendar' | 'search' | 'database' | 'shield'

export interface Service {
  icon: ServiceIcon
  title: string
  body: string
  points: string[]
  /** The two services the page leads with get the wide cards. */
  featured?: boolean
}

export const SERVICES: Service[] = [
  {
    icon: 'layout',
    title: 'Landing pages that bring in customers',
    body: 'One fast page with everything a customer needs to choose you: what you offer, photos, location, hours, and one clear button to message or call.',
    points: ['Made for phones first', 'Loads fast, even on mobile data', 'HTTPS, no "Not secure" warning', 'Your own domain name'],
    featured: true,
  },
  {
    icon: 'messenger',
    title: 'Facebook and Messenger, connected',
    body: 'Your website and your Facebook page working together, so every visitor is one tap away from a conversation, and every ad peso is measured.',
    points: ['Messenger chat button on your site', 'Meta Pixel for your Facebook ads', 'Facebook reviews and posts on your page', 'Lead forms that land in your inbox'],
    featured: true,
  },
  {
    icon: 'calendar',
    title: 'Booking, orders and inquiries',
    body: 'Appointment requests, order forms and quote requests that arrive in your email, Messenger or a Google Sheet, with payment details or a payment link where you need them.',
    points: [],
  },
  {
    icon: 'search',
    title: 'Found on Google',
    body: 'Your Google Business Profile set up and linked, the search basics done properly, and simple numbers on how many people found you.',
    points: [],
  },
  {
    icon: 'database',
    title: 'Systems for growing businesses',
    body: 'Inventory, point of sale, attendance and payroll, loan and pawn ledgers, client portals and admin dashboards. The same kind of systems I build for companies abroad.',
    points: [],
  },
  {
    icon: 'shield',
    title: 'Looked after once it is live',
    body: 'Hosting, security updates, small edits and fixes. You own the domain and the site, and you can always take it elsewhere.',
    points: [],
  },
]

export interface Project {
  name: string
  kind: string
  where: string
  body: string
  url: string
  host: string
  /** A 1280x800 still from /videos/work. */
  image: string
}

/**
 * Real work, built or maintained by JKC at OSL International. Kept to the
 * pieces a business owner can open and judge for themselves.
 */
export const PROJECTS: Project[] = [
  {
    name: 'Capital Financial Services',
    kind: 'Website and loan calculator',
    where: 'New Zealand',
    body: 'A fast, plain-spoken finance site with a live repayment calculator up front and an enquiry flow behind it.',
    url: 'https://capitalfinancialservices.co.nz/',
    host: 'capitalfinancialservices.co.nz',
    image: '/videos/work/cfs.webp',
  },
  {
    name: 'Jet Logistics',
    kind: 'Company website',
    where: 'Japan',
    body: 'Vehicle shipping out of Kobe: live shipping schedules, a services catalogue and quote requests.',
    url: 'https://www.jetlogistics.co.jp/',
    host: 'jetlogistics.co.jp',
    image: '/videos/work/jet.webp',
  },
  {
    name: 'Global Inspection Specialists',
    kind: 'Web platform',
    where: 'Japan and worldwide',
    body: 'Vehicle and equipment inspection, with live certificate checks for governments and buyers.',
    url: 'https://globalinspectionspecialist.com/',
    host: 'globalinspectionspecialist.com',
    image: '/videos/work/gis.webp',
  },
  {
    name: 'IBC Auto',
    kind: 'Online marketplace',
    where: 'Japan',
    body: 'A used-car export marketplace with search across 100,000+ vehicles, auctions and detailed vehicle pages.',
    url: 'https://ibcauto.com/search',
    host: 'ibcauto.com',
    image: '/videos/work/ibc.webp',
  },
]

export interface Step {
  title: string
  body: string
}

export const STEPS: Step[] = [
  {
    title: 'Tell me about your business',
    body: 'Send a message through the form, email or Messenger. What you sell, who your customers are, and what you have today.',
  },
  {
    title: 'Get a plan and a free first draft',
    body: 'I reply within a day or two with what I would build, a quote that fits your budget, and a first draft of your homepage, free.',
  },
  {
    title: 'Watch it come together',
    body: 'You check progress on your own phone as I build. A landing page usually takes one to two weeks.',
  },
  {
    title: 'Launch, then I stay around',
    body: 'I put it live on your domain, connect your Facebook page and Google profile, and show you how to update it.',
  },
]

export interface Faq {
  q: string
  a: string
}

export const FAQS: Faq[] = [
  {
    q: 'How much does it cost?',
    a: 'It depends on what you need, so every project gets its own quote, and the price is open to discussion. You see the full price before any work starts, and you can pay in parts.',
  },
  {
    q: 'I already have a Facebook page. Why do I need a website?',
    a: 'Keep the page, it is where your regulars are. A website is what new customers find on Google, it shows your services and location without the scrolling, and it makes you look established. The two work best linked together, which is exactly what I set up.',
  },
  {
    q: 'How long does it take?',
    a: 'A landing page usually takes one to two weeks from the day you send your photos and details. Booking forms and Facebook integrations add a few days. Bigger systems are planned with you in stages.',
  },
  {
    q: 'Will I pay for hosting every month?',
    a: 'Usually not much, if anything. A simple site can run on free or very low-cost hosting. The yearly cost to plan for is your domain name, and I will tell you the exact amount up front.',
  },
  {
    q: 'Can I update it myself?',
    a: 'Yes. I can set it up so you can change prices, photos and hours yourself, and I will show you how. Or just send me a message and I will do it.',
  },
  {
    q: 'Do you work with businesses outside the Philippines?',
    a: 'Yes. I am based in Cebu City, Philippines, and I work with clients anywhere over video calls, chat and email. Most of my work so far has been for companies in Japan and New Zealand. If you are nearby, I am happy to meet in person.',
  },
  {
    q: 'Do you build bigger systems too?',
    a: 'Yes. Most of my career has been business software: inventory, records, internal tools and customer portals for companies in Japan, New Zealand and the Philippines. If your business needs more than a website, we can talk about that.',
  },
]
