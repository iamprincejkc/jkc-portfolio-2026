/**
 * Searching and filtering the directory, in the browser, on every keystroke.
 *
 * Under two thousand entries is small enough that a linear scan is the right
 * answer - an inverted index would need building, keeping and debugging to
 * beat it by a margin nobody can perceive. What does matter is not re-lowering
 * two thousand strings per keystroke, so each entry gets its haystack built
 * once when the catalog lands and reused for the life of the page.
 *
 * Matching is AND across tokens: typing more words narrows the result, which
 * is what a search box is expected to do and what naive OR scoring gets wrong.
 */
import type { ApiEntry, Auth, Cors } from './types'

export interface IndexedEntry {
  entry: ApiEntry
  name: string
  host: string
  /** Name, host, category and description, lowercased and joined. */
  haystack: string
}

export type SortKey = 'relevance' | 'name' | 'category'

export interface Filters {
  query: string
  category: string
  auth: string
  cors: string
  /** Only the entries a page can call directly. Stored as `'1'` or `''`. */
  ready: string
}

export const EMPTY_FILTERS: Filters = { query: '', category: '', auth: '', cors: '', ready: '' }

export const AUTHS: Auth[] = ['None', 'API key', 'OAuth', 'Other']
export const CORS_VALUES: Cors[] = ['Yes', 'No', 'Unknown']

/** The facets the rail renders, in the order it renders them. */
export const FACETS = ['category', 'auth', 'cors'] as const
export type Facet = (typeof FACETS)[number]

/** Prepares each entry once, so searching never re-allocates its strings. */
export function buildIndex(entries: ApiEntry[]): IndexedEntry[] {
  return entries.map((entry) => ({
    entry,
    name: entry.name.toLowerCase(),
    host: entry.host.toLowerCase(),
    haystack: [entry.name, entry.host, entry.category, entry.description].join('  ').toLowerCase(),
  }))
}

/** Splits a query into the words every result has to contain. */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9.+#-]+/i).filter(Boolean)
}

/**
 * How well one entry answers one token.
 *
 * The weights encode a single judgement: a hit in the name is what the person
 * meant, a hit in the description is probably a coincidence. Searching
 * "stripe" should not rank forty payment APIs that mention Stripe above
 * Stripe. Returns 0 when the token is absent, which is what makes the AND
 * across tokens work.
 */
function scoreToken(item: IndexedEntry, token: string): number {
  const inName = item.name.indexOf(token)
  if (inName === 0) return 12
  if (inName > 0) return item.name[inName - 1] === ' ' ? 9 : 5

  // The host is how you recognise an API whose name is a generic noun -
  // "Weather" is ambiguous, `open-meteo.com` is not.
  if (item.host.startsWith(token)) return 6
  if (item.host.includes(token)) return 3

  return item.haystack.includes(token) ? 1 : 0
}

/**
 * How immediately usable an entry is, for the view nobody has searched yet.
 *
 * There is no relevance to rank by, and alphabetical opens the directory on
 * whatever happens to start with a digit. The useful question a browser is
 * asking is "what can I call right now" - so no credentials dominates, HTTPS
 * and confirmed CORS follow, and an entry that needs a signup form ranks last
 * without being hidden.
 */
export function readyScore(entry: ApiEntry): number {
  return (
    (entry.auth === 'None' ? 100 : entry.auth === 'API key' ? 20 : 0) +
    (entry.cors === 'Yes' ? 40 : entry.cors === 'Unknown' ? 10 : 0) +
    (entry.https ? 20 : 0)
  )
}

function passesFilters(entry: ApiEntry, filters: Filters): boolean {
  if (filters.category && entry.category !== filters.category) return false
  if (filters.auth && entry.auth !== filters.auth) return false
  if (filters.cors && entry.cors !== filters.cors) return false
  if (filters.ready && !entry.ready) return false
  return true
}

interface Match {
  entry: ApiEntry
  score: number
}

/**
 * Everything that survives the filters and the query, unordered.
 *
 * Separate from the ranking because the facet counts need this and not that:
 * counting how many results an option would produce does not care what order
 * they come in, and there are three facets recounted on every keystroke.
 * Sorting inside would make one filter click pay for four sorts.
 */
function matchingEntries(index: IndexedEntry[], filters: Filters, tokens: string[]): Match[] {
  const matches: Match[] = []

  for (const item of index) {
    if (!passesFilters(item.entry, filters)) continue

    let score = 0
    let matchedAll = true
    for (const token of tokens) {
      const hit = scoreToken(item, token)
      if (hit === 0) {
        matchedAll = false
        break
      }
      score += hit
    }
    if (!matchedAll) continue

    matches.push({ entry: item.entry, score })
  }

  return matches
}

/**
 * Deals the first screen from every category in turn, rather than from the
 * top of one.
 *
 * Ranked purely by usability, the unsearched view opens on a run of whatever
 * category happens to hold the most no-key APIs - twenty-four cards that all
 * say "Animals" describe the directory as narrow when it is the opposite.
 * Round-robin across categories keeps the ranking inside each one intact and
 * makes the first screen a sample of the whole thing.
 *
 * Only the unsearched view wants this. Once somebody has typed a query,
 * relevance order is the point and grouping would fight it.
 */
function dealByCategory(matches: Match[]): Match[] {
  const lanes = new Map<string, Match[]>()
  for (const match of matches) {
    const lane = lanes.get(match.entry.category)
    if (lane) lane.push(match)
    else lanes.set(match.entry.category, [match])
  }

  // Best-stocked category first, so the tail of the deal thins out evenly
  // instead of ending on a run of singletons.
  const queues = [...lanes.values()].sort((a, b) => b.length - a.length)
  const dealt: Match[] = []

  for (let round = 0; dealt.length < matches.length; round++) {
    for (const queue of queues) {
      if (round < queue.length) dealt.push(queue[round])
    }
  }

  return dealt
}

/** The filtered, ranked result list. */
export function searchCatalog(index: IndexedEntry[], filters: Filters, sort: SortKey = 'relevance'): ApiEntry[] {
  const tokens = tokenize(filters.query)
  const matches = matchingEntries(index, filters, tokens)

  if (sort === 'name') {
    matches.sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  } else if (sort === 'category') {
    matches.sort(
      (a, b) =>
        a.entry.category.localeCompare(b.entry.category) || a.entry.name.localeCompare(b.entry.name),
    )
  } else if (tokens.length === 0) {
    matches.sort(
      (a, b) => readyScore(b.entry) - readyScore(a.entry) || a.entry.name.localeCompare(b.entry.name),
    )
    // Already inside one category: there is nothing to deal across.
    if (!filters.category) return dealByCategory(matches).map((match) => match.entry)
  } else {
    matches.sort(
      (a, b) =>
        b.score - a.score ||
        readyScore(b.entry) - readyScore(a.entry) ||
        a.entry.name.localeCompare(b.entry.name),
    )
  }

  return matches.map((match) => match.entry)
}

/**
 * How many results each option of a facet would produce, given the others.
 *
 * The facet being counted is relaxed first, which is what makes the numbers
 * mean "click this and you get N" rather than "you have already excluded
 * these".
 */
export function facetCounts(index: IndexedEntry[], filters: Filters, facet: Facet): Map<string, number> {
  const relaxed = { ...filters, [facet]: '' }
  const counts = new Map<string, number>()

  for (const { entry } of matchingEntries(index, relaxed, tokenize(relaxed.query))) {
    const value = entry[facet]
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return counts
}

/** How many results the browser-ready toggle would produce if turned on. */
export function readyCount(index: IndexedEntry[], filters: Filters): number {
  const relaxed = { ...filters, ready: '1' }
  return matchingEntries(index, relaxed, tokenize(relaxed.query)).length
}
