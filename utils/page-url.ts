/**
 * The public form of a page's URL: with a trailing slash, except the home page.
 *
 * Every prerendered page is written as `<route>/index.html`, and Netlify
 * serves those at `/about/`, answering `/about` with a 301 to it (measured on
 * iamjkc.space, 2026-11-13). A canonical tag, sitemap entry or link that
 * points at `/about` therefore points at a redirect, which search engines
 * have to follow and may treat as a weaker signal. So everything that names a
 * page by URL goes through here and names the address that answers 200.
 */
export function pagePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || '/'
  if (clean === '/') return '/'
  return clean.endsWith('/') ? clean : `${clean}/`
}

/** Absolute URL of a page on `siteUrl`, in its public form. */
export function pageUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, '')}${pagePath(path)}`
}
