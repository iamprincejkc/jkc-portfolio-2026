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
    '# The workflow library is one page backed by ~2,000 JSON files. The page',
    '# is worth indexing; the data behind it is not - it has no title, nothing',
    '# to rank on, and crawling all of it would spend this site\'s entire crawl',
    '# budget on machine-readable files nobody searches for.',
    'Disallow: /n8n/workflows/',
    'Disallow: /n8n/catalog.json',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')
})
