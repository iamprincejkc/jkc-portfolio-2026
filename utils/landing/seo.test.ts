import { describe, expect, it } from 'vitest'
import { FAQS, SERVICES } from './content'
import { LANDING_SEO, landingGraph } from './seo'

const base = 'https://iamjkc.space'
const graph = landingGraph(base)['@graph'] as Record<string, any>[]
const node = (type: string) => graph.find((n) => n['@type'] === type)!

describe('landing SEO', () => {
  it('keeps the title and description within what Google usually shows', () => {
    expect(LANDING_SEO.title.length).toBeLessThanOrEqual(62)
    expect(LANDING_SEO.description.length).toBeGreaterThanOrEqual(120)
    expect(LANDING_SEO.description.length).toBeLessThanOrEqual(160)
  })

  it('never uses an em dash or names a service area', () => {
    const all = JSON.stringify([LANDING_SEO, graph])
    expect(all).not.toContain('—')
    expect(all).not.toMatch(/Mandaue|Lapu-Lapu|areaServed/)
  })

  it('declares the site name on the home page URL', () => {
    expect(node('WebSite')).toMatchObject({ url: `${base}/`, name: 'Jan Kevin Cadampog' })
  })

  it('gives the organisation a crawlable logo of at least 112px', () => {
    const logo = node('Organization').logo
    expect(logo.url).toBe(`${base}/images/logo.png`)
    expect(Math.min(logo.width, logo.height)).toBeGreaterThanOrEqual(112)
  })

  it('resolves every @id reference to a node in the graph', () => {
    const ids = new Set<string>()
    const refs: string[] = []
    // A node that is only { "@id": ... } is a reference; anything more defines the id.
    const walk = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(walk)
      if (!v || typeof v !== 'object') return
      const o = v as Record<string, unknown>
      const id = o['@id']
      if (typeof id === 'string') {
        if (Object.keys(o).length === 1) refs.push(id)
        else ids.add(id)
      }
      Object.values(o).forEach(walk)
    }
    walk(graph)
    for (const r of refs) expect(ids).toContain(r)
  })

  it('marks up exactly the services and questions shown on the page, with no prices', () => {
    const offers = node('Organization').hasOfferCatalog.itemListElement
    expect(offers.map((o: any) => o.itemOffered.name)).toEqual(SERVICES.map((s) => s.title))
    expect(JSON.stringify(offers)).not.toMatch(/price/i)
    expect(node('FAQPage').mainEntity.map((q: any) => q.name)).toEqual(FAQS.map((f) => f.q))
  })
})
