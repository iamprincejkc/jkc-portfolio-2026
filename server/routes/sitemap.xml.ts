/**
 * sitemap.xml
 *
 * Lists only the public portfolio. /gallery and /evently are deliberately
 * absent: they are unlisted, and putting them here would be the fastest way to
 * get them indexed.
 */
const PUBLIC_ROUTES = ['/']

export default defineEventHandler((event) => {
  const siteUrl = String(useRuntimeConfig().public.siteUrl ?? '').replace(/\/$/, '')
  const lastmod = new Date().toISOString().split('T')[0]

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')

  const urls = PUBLIC_ROUTES.map(
    (path) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`,
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
})
