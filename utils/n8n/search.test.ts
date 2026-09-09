import { describe, expect, it } from 'vitest'
import {
  buildIndex,
  EMPTY_FILTERS,
  facetCounts,
  featuredScore,
  searchCatalog,
  tokenize,
  topIntegrations,
} from './search'
import type { CatalogEntry } from './types'

function entry(partial: Partial<CatalogEntry> & { id: string; name: string }): CatalogEntry {
  return {
    category: 'Data Processing & Analysis',
    trigger: 'Manual',
    complexity: 'Simple',
    steps: 4,
    integrations: [],
    summary: '',
    bytes: 100,
    ...partial,
  }
}

const CATALOG: CatalogEntry[] = [
  entry({
    id: 'a',
    name: 'Slack alerts from Google Sheets',
    integrations: ['Slack', 'Google Sheets'],
    category: 'Communication & Messaging',
    trigger: 'Scheduled',
    steps: 6,
    complexity: 'Standard',
  }),
  entry({
    id: 'b',
    name: 'Invoice parser',
    summary: 'Reads a PDF and posts the total to Slack.',
    documented: 1,
    integrations: ['OpenAI'],
    steps: 12,
    complexity: 'Standard',
  }),
  entry({
    id: 'c',
    name: 'Sheet cleanup',
    integrations: ['Google Sheets'],
    trigger: 'Webhook',
    steps: 2,
  }),
]

const INDEX = buildIndex(CATALOG)

function ids(filters: Partial<typeof EMPTY_FILTERS>, sort?: Parameters<typeof searchCatalog>[2]) {
  return searchCatalog(INDEX, { ...EMPTY_FILTERS, ...filters }, sort).map((e) => e.id)
}

describe('tokenize', () => {
  it('keeps the characters that appear in product names', () => {
    expect(tokenize('Monday.com c# node-red')).toEqual(['monday.com', 'c#', 'node-red'])
  })

  it('is empty for an empty query', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('searchCatalog', () => {
  it('opens on the workflows worth reading, not the smallest ones', () => {
    // b is documented; a has two services and is nearer ten steps than c.
    expect(ids({})).toEqual(['b', 'a', 'c'])
  })

  it('does not put the same title twice on the first screen', () => {
    const twins = buildIndex([
      entry({ id: 'p', name: 'UTM link creator', documented: 1, steps: 10, integrations: ['Airtable'] }),
      entry({ id: 'q', name: 'UTM link creator', documented: 1, steps: 10, integrations: ['Airtable'] }),
      entry({ id: 'r', name: 'Something else', documented: 1, steps: 10, integrations: ['Airtable'] }),
    ])
    // q scores identically to p, but the repeated title goes behind the rest.
    expect(searchCatalog(twins, EMPTY_FILTERS).map((e) => e.id)).toEqual(['r', 'p', 'q'])
  })

  it('treats a repeated summary as a repeat too, whatever the titles say', () => {
    const boilerplate = 'Developed by Amjid Ali. Thank you for using this workflow template.'
    const twins = buildIndex([
      entry({ id: 'p', name: 'Code Strava Automation', summary: boilerplate, documented: 1, steps: 10 }),
      entry({ id: 'q', name: 'Code Strava Send', summary: boilerplate, documented: 1, steps: 10 }),
      entry({ id: 'r', name: 'Something else', summary: 'Its own words.', documented: 1, steps: 10 }),
    ])
    expect(searchCatalog(twins, EMPTY_FILTERS).map((e) => e.id)).toEqual(['p', 'r', 'q'])
  })

  it('keeps near-matches together once someone has actually searched', () => {
    const twins = buildIndex([
      entry({ id: 'p', name: 'UTM link creator' }),
      entry({ id: 'q', name: 'UTM link creator' }),
    ])
    expect(searchCatalog(twins, { ...EMPTY_FILTERS, query: 'utm' }).map((e) => e.id)).toEqual(['p', 'q'])
  })

  it('ranks a name hit above a summary hit', () => {
    expect(ids({ query: 'slack' })).toEqual(['a', 'b'])
  })

  it('narrows as you add words rather than widening', () => {
    expect(ids({ query: 'sheet' })).toEqual(['c', 'a'])
    expect(ids({ query: 'sheet slack' })).toEqual(['a'])
    expect(ids({ query: 'sheet slack nonsense' })).toEqual([])
  })

  it('matches integrations and categories, not only the name', () => {
    expect(ids({ query: 'openai' })).toEqual(['b'])
    expect(ids({ query: 'messaging' })).toEqual(['a'])
  })

  it('applies each filter', () => {
    expect(ids({ trigger: 'Webhook' })).toEqual(['c'])
    expect(ids({ complexity: 'Standard' })).toEqual(['b', 'a'])
    expect(ids({ integration: 'Google Sheets' })).toEqual(['a', 'c'])
    expect(ids({ category: 'Communication & Messaging' })).toEqual(['a'])
  })

  it('combines filters with the query', () => {
    expect(ids({ query: 'sheet', trigger: 'Webhook' })).toEqual(['c'])
  })

  it('sorts by name and by size on request', () => {
    expect(ids({}, 'name')).toEqual(['b', 'c', 'a'])
    expect(ids({}, 'steps')).toEqual(['c', 'a', 'b'])
  })
})

describe('facetCounts', () => {
  it('counts each option as if only the other filters were applied', () => {
    // Filtering to Webhook must not reduce the Webhook facet to one option.
    const counts = facetCounts(INDEX, { ...EMPTY_FILTERS, trigger: 'Webhook' }, 'trigger')
    expect(counts.get('Webhook')).toBe(1)
    expect(counts.get('Manual')).toBe(1)
    expect(counts.get('Scheduled')).toBe(1)
  })

  it('still respects the other filters', () => {
    const counts = facetCounts(INDEX, { ...EMPTY_FILTERS, query: 'sheet', trigger: 'Webhook' }, 'trigger')
    expect(counts.get('Webhook')).toBe(1)
    expect(counts.get('Manual')).toBeUndefined()
  })
})

describe('featuredScore', () => {
  it('puts a documented workflow above an undocumented one of the same shape', () => {
    const plain = entry({ id: 'x', name: 'x', steps: 10, integrations: ['Slack'] })
    const documented = { ...plain, documented: 1 as const }
    expect(featuredScore(documented)).toBeGreaterThan(featuredScore(plain))
  })

  it('penalises both a one-node stub and a hundred-node monster', () => {
    const size = (steps: number) => featuredScore(entry({ id: 'x', name: 'x', steps }))
    expect(size(10)).toBeGreaterThan(size(1))
    expect(size(10)).toBeGreaterThan(size(100))
  })

  it('stops rewarding integrations past a handful', () => {
    const withServices = (n: number) =>
      featuredScore(entry({ id: 'x', name: 'x', steps: 10, integrations: Array.from({ length: n }, (_, i) => `s${i}`) }))
    expect(withServices(3)).toBeGreaterThan(withServices(1))
    expect(withServices(12)).toBe(withServices(4))
  })
})

describe('topIntegrations', () => {
  it('offers the most common services first', () => {
    expect(topIntegrations(CATALOG, 2)).toEqual(['Google Sheets', 'OpenAI'])
  })
})
