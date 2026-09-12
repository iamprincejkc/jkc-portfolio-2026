import { describe, expect, it } from 'vitest'
import {
  buildIndex,
  EMPTY_FILTERS,
  facetCounts,
  readyCount,
  readyScore,
  searchCatalog,
  tokenize,
} from './search'
import type { ApiEntry } from './types'

function api(partial: Partial<ApiEntry> & { id: string; name: string }): ApiEntry {
  const entry: ApiEntry = {
    description: '',
    category: 'Development',
    auth: 'None',
    https: true,
    cors: 'Unknown',
    url: 'https://example.com',
    host: 'example.com',
    ...partial,
  }
  if (entry.auth === 'None' && entry.https && entry.cors === 'Yes') entry.ready = 1
  return entry
}

const CATALOG: ApiEntry[] = [
  api({ id: '1', name: 'Stripe', category: 'Finance', auth: 'API key', cors: 'No', host: 'stripe.com' }),
  api({
    id: '2',
    name: 'Payment Gateway',
    description: 'Accepts cards through Stripe and PayPal',
    category: 'Finance',
    auth: 'OAuth',
  }),
  api({ id: '3', name: 'Cat Facts', category: 'Animals', cors: 'Yes', host: 'catfact.ninja' }),
  api({ id: '4', name: 'Dog CEO', category: 'Animals', cors: 'Yes', host: 'dog.ceo' }),
  api({ id: '5', name: 'Open Meteo', description: 'Weather forecasts', category: 'Weather', cors: 'Yes', host: 'open-meteo.com' }),
  api({ id: '6', name: 'Legacy Weather', category: 'Weather', https: false, cors: 'No' }),
]

const index = buildIndex(CATALOG)
const search = (filters: Partial<typeof EMPTY_FILTERS>, sort?: 'relevance' | 'name' | 'category') =>
  searchCatalog(index, { ...EMPTY_FILTERS, ...filters }, sort).map((entry) => entry.name)

describe('tokenize', () => {
  it('keeps the characters that appear in API names', () => {
    expect(tokenize('open-meteo v2.0 c#')).toEqual(['open-meteo', 'v2.0', 'c#'])
  })

  it('ignores punctuation and empty words', () => {
    expect(tokenize('  cat,  facts! ')).toEqual(['cat', 'facts'])
  })
})

describe('searchCatalog', () => {
  it('ranks a name match above a mention in a description', () => {
    expect(search({ query: 'stripe' })).toEqual(['Stripe', 'Payment Gateway'])
  })

  it('narrows as tokens are added rather than widening', () => {
    expect(search({ query: 'cat' })).toEqual(['Cat Facts'])
    expect(search({ query: 'cat facts' })).toEqual(['Cat Facts'])
    expect(search({ query: 'cat dogs' })).toEqual([])
  })

  it('finds an API by its host when the name would not', () => {
    expect(search({ query: 'ninja' })).toEqual(['Cat Facts'])
  })

  it('filters by category, auth and CORS together', () => {
    expect(search({ category: 'Animals' })).toEqual(['Cat Facts', 'Dog CEO'])
    expect(search({ auth: 'OAuth' })).toEqual(['Payment Gateway'])
    expect(search({ category: 'Weather', cors: 'Yes' })).toEqual(['Open Meteo'])
  })

  it('keeps only the browser-ready entries when asked', () => {
    // Dealt across categories, so Animals' two are split by Weather's one.
    expect(search({ ready: '1' })).toEqual(['Cat Facts', 'Open Meteo', 'Dog CEO'])
  })

  it('sorts by name and by category on request', () => {
    expect(search({ category: 'Finance' }, 'name')).toEqual(['Payment Gateway', 'Stripe'])
    expect(search({}, 'category').slice(0, 3)).toEqual(['Cat Facts', 'Dog CEO', 'Payment Gateway'])
  })

  it('deals the unsearched view across categories rather than down one', () => {
    // Every category is represented before any category repeats.
    const first = search({}).slice(0, 3)
    const categories = first.map((name) => CATALOG.find((entry) => entry.name === name)!.category)
    expect(new Set(categories).size).toBe(3)
  })

  it('does not deal across categories once inside one', () => {
    expect(search({ category: 'Weather' })).toEqual(['Open Meteo', 'Legacy Weather'])
  })

  it('returns every entry exactly once when dealing', () => {
    const dealt = search({})
    expect(dealt).toHaveLength(CATALOG.length)
    expect(new Set(dealt).size).toBe(CATALOG.length)
  })
})

describe('readyScore', () => {
  it('puts no credentials above everything else', () => {
    const noKey = api({ id: 'a', name: 'a', auth: 'None', cors: 'No', https: false })
    const keyedAndPerfect = api({ id: 'b', name: 'b', auth: 'API key', cors: 'Yes', https: true })
    expect(readyScore(noKey)).toBeGreaterThan(readyScore(keyedAndPerfect))
  })

  it('rates unverified CORS between confirmed and refused', () => {
    const yes = api({ id: 'a', name: 'a', cors: 'Yes' })
    const unknown = api({ id: 'b', name: 'b', cors: 'Unknown' })
    const no = api({ id: 'c', name: 'c', cors: 'No' })
    expect(readyScore(yes)).toBeGreaterThan(readyScore(unknown))
    expect(readyScore(unknown)).toBeGreaterThan(readyScore(no))
  })
})

describe('facetCounts', () => {
  it('counts what each option would produce, ignoring that facet', () => {
    const counts = facetCounts(index, { ...EMPTY_FILTERS, category: 'Animals' }, 'category')
    // The Animals filter is relaxed, so every category is still counted.
    expect(counts.get('Animals')).toBe(2)
    expect(counts.get('Weather')).toBe(2)
  })

  it('still honours the other facets', () => {
    const counts = facetCounts(index, { ...EMPTY_FILTERS, cors: 'Yes' }, 'category')
    expect(counts.get('Animals')).toBe(2)
    expect(counts.get('Finance')).toBeUndefined()
  })
})

describe('readyCount', () => {
  it('reports what the toggle would leave, given the current search', () => {
    expect(readyCount(index, EMPTY_FILTERS)).toBe(3)
    expect(readyCount(index, { ...EMPTY_FILTERS, category: 'Animals' })).toBe(2)
    expect(readyCount(index, { ...EMPTY_FILTERS, query: 'stripe' })).toBe(0)
  })
})
