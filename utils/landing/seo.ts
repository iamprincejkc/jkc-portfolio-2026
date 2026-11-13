import { BASE, CONTACT, FAQS, PROJECTS, SERVICES } from './content'

/**
 * Search metadata for the landing page, and the reasoning behind it, checked
 * against Google Search Central in November 2026:
 *
 * - Title: the page's topic first, the name last. Google shortens title links
 *   to fit the screen (roughly 60 characters on desktop), so what the page is
 *   comes before who made it.
 * - Description: about 155 characters, the offer in plain words. Google may
 *   still choose its own snippet from the page.
 * - robots: `max-image-preview:large` lets Google show the large share image
 *   in results and Discover; `max-snippet:-1` sets no snippet limit.
 * - Structured data: one @graph, so every node points at the others by @id
 *   rather than being repeated.
 *     WebSite      on the home page, which is where Google reads the site name.
 *     Organization the personal brand, with a logo of at least 112x112px,
 *                  which is what Google uses for the logo in results.
 *     Person       JKC himself: title, profiles, and the work on this page.
 *     WebPage      ties the page to the site and the brand.
 *     OfferCatalog the services as they appear on the page, with no prices
 *                  because the page shows none.
 *     FAQPage      the questions as they appear on the page. Google stopped
 *                  showing FAQ rich results on 7 May 2026, but the markup is
 *                  still valid Schema.org and describes visible content.
 *   No LocalBusiness: Google requires a physical address for it, and the
 *   business has no premises and no service area by design.
 *
 * Structured data must describe what a visitor can see. Anything added here
 * has to be on the page too.
 */
export const LANDING_SEO = {
  title: 'Small Business Websites & Landing Pages | Jan Kevin Cadampog',
  description:
    'Fast landing pages, Facebook and Messenger integration, booking forms and business systems for small businesses. By Senior Software Engineer Jan Kevin Cadampog.',
  socialTitle: 'Websites that turn Facebook visitors into customers',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  ogImage: {
    path: '/images/og-business.png',
    width: 1200,
    height: 630,
    alt: 'Websites that turn Facebook visitors into customers, by Jan Kevin Cadampog, Senior Software Engineer',
  },
  logo: { path: '/images/logo.png', width: 512, height: 512 },
} as const

/** The JSON-LD graph for `/`. `base` is the site origin with no trailing slash. */
export function landingGraph(base: string) {
  const id = (frag: string) => `${base}/#${frag}`
  const sameAs = [CONTACT.linkedin, CONTACT.github, 'https://dev.to/iamprincejkc']

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': id('website'),
        url: `${base}/`,
        name: 'Jan Kevin Cadampog',
        alternateName: ['JKC', 'iamjkc'],
        inLanguage: 'en',
        publisher: { '@id': id('organization') },
      },
      {
        '@type': 'Organization',
        '@id': id('organization'),
        name: 'Jan Kevin Cadampog',
        alternateName: 'JKC',
        url: `${base}/`,
        description: LANDING_SEO.description,
        logo: {
          '@type': 'ImageObject',
          '@id': id('logo'),
          url: `${base}${LANDING_SEO.logo.path}`,
          contentUrl: `${base}${LANDING_SEO.logo.path}`,
          width: LANDING_SEO.logo.width,
          height: LANDING_SEO.logo.height,
          caption: 'JKC',
        },
        image: { '@id': id('logo') },
        email: CONTACT.email,
        founder: { '@id': id('person') },
        sameAs,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: CONTACT.email,
          availableLanguage: ['English', 'Filipino'],
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Websites and business systems',
          itemListElement: SERVICES.map((s) => ({
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: s.title,
              description: s.body,
              provider: { '@id': id('organization') },
            },
          })),
        },
      },
      {
        '@type': 'Person',
        '@id': id('person'),
        name: 'Jan Kevin Cadampog',
        alternateName: 'JKC',
        jobTitle: 'Senior Software Engineer',
        url: `${base}/me`,
        image: `${base}/images/main.webp`,
        email: `mailto:${CONTACT.email}`,
        address: { '@type': 'PostalAddress', addressLocality: BASE.city, addressCountry: BASE.countryCode },
        knowsAbout: [
          'Landing pages',
          'Web development',
          'Facebook Messenger integration',
          'Meta Pixel',
          'Google Business Profile',
          'Booking and order forms',
          'Business software',
          '.NET',
          'Angular',
          'SQL Server',
        ],
        sameAs,
        // The sites on the page, which this person built or maintains.
        subjectOf: PROJECTS.map((p) => ({ '@type': 'WebSite', name: p.name, url: p.url })),
      },
      {
        '@type': 'WebPage',
        '@id': id('webpage'),
        url: `${base}/`,
        name: LANDING_SEO.title,
        description: LANDING_SEO.description,
        inLanguage: 'en',
        isPartOf: { '@id': id('website') },
        about: { '@id': id('organization') },
        author: { '@id': id('person') },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${base}${LANDING_SEO.ogImage.path}`,
          width: LANDING_SEO.ogImage.width,
          height: LANDING_SEO.ogImage.height,
        },
      },
      {
        '@type': 'FAQPage',
        '@id': id('faq'),
        isPartOf: { '@id': id('webpage') },
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  }
}
