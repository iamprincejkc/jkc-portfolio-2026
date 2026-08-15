/**
 * robots.txt
 *
 * A server route rather than a static file so the Sitemap directive can carry
 * the real origin - that directive must be an absolute URL, and the domain
 * lives in config.
 */
export default defineEventHandler((event) => {
  const siteUrl = String(useRuntimeConfig().public.siteUrl ?? '').replace(/\/$/, '')

  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')

  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# Unlisted routes. The gallery is PIN-gated regardless; there is simply no',
    '# reason for either to appear in search results.',
    'Disallow: /gate',
    'Disallow: /gallery',
    'Disallow: /evently',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
})
