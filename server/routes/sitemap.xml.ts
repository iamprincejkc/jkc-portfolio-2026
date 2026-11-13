import { pageUrl } from '../../utils/page-url'

/**
 * sitemap.xml
 *
 * Lists the public pages. /gallery, /evently and /monthsary are deliberately
 * absent: they are unlisted, and putting them here would be the fastest way to
 * get them indexed. /qr-generator, /n8n and /public-api are genuinely public tools and
 * belong here.
 *
 * The per-workflow files under /n8n/ and the catalog under /public-api/ are
 * data, not pages - they have no HTML, no title and nothing to rank, so
 * listing them would spend the crawl budget for this site on JSON.
 */
const PUBLIC_ROUTES = ['/', '/me', '/about', '/qr-generator', '/n8n', '/public-api']

// No <changefreq> or <priority>: Google ignores both and reads only <lastmod>,
// which is the build date - the pages are prerendered, so a build is when they change.
export default defineEventHandler((event) => {
  const siteUrl = String(useRuntimeConfig().public.siteUrl ?? '').replace(/\/$/, '')
  const lastmod = new Date().toISOString().split('T')[0]

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')

  const urls = PUBLIC_ROUTES.map(
    (path) => `  <url>
    <loc>${pageUrl(siteUrl, path)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
})
