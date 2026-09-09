/**
 * Searching and filtering the catalog, in the browser, on every keystroke.
 *
 * Two thousand entries is small enough that a linear scan is the right answer:
 * an inverted index would need building, keeping and debugging, and would beat
 * a scan by a margin nobody can perceive. What does matter is not re-lowering
 * two thousand strings on every keystroke, so each entry gets its haystack
 * built once when the catalog lands and reused for the life of the page.
 *
 * Matching is AND across tokens - typing more words narrows the result rather
 * than widening it, which is what a search box is expected to do and what a
 * naive OR-scoring implementation gets wrong.
 */
import type { CatalogEntry, Complexity, Trigger } from './types'

export interface IndexedEntry {
  entry: CatalogEntry
  name: string
  /** Name, integrations, category and summary, lowercased and joined. */
  haystack: string
  /** `featuredScore`, computed once rather than twice per comparison. */
  featured: number
}

export type SortKey = 'relevance' | 'name' | 'steps'

export interface Filters {
  query: string
  category: string
  trigger: string
  complexity: string
  /** A single service, chosen by clicking its chip on a card. */
  integration: string
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  category: '',
  trigger: '',
  complexity: '',
  integration: '',
}

/** Prepares each entry once, so searching never re-allocates its strings. */
export function buildIndex(entries: CatalogEntry[]): IndexedEntry[] {
  return entries.map((entry) => ({
    entry,
    name: entry.name.toLowerCase(),
    haystack: [
      entry.name,
      entry.integrations.join(' '),
      entry.category,
      entry.trigger,
      entry.summary,
    ]
      .join('  ')
      .toLowerCase(),
    featured: featuredScore(entry),
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
 * meant, a hit in the summary is probably a coincidence. Returns 0 when the
 * token is absent, which is what makes the AND across tokens work.
 */
function scoreToken(item: IndexedEntry, token: string): number {
  const inName = item.name.indexOf(token)
  if (inName === 0) return 10
  if (inName > 0) return item.name[inName - 1] === ' ' ? 8 : 5

  for (const service of item.entry.integrations) {
    if (service.toLowerCase().startsWith(token)) return 4
  }

  return item.haystack.includes(token) ? 1 : 0
}

/**
 * What to show when nobody has searched for anything.
 *
 * There is no relevance to rank by, and every alternative is worse than it
 * looks. File order puts the first hundred filenames on the first screen,
 * which samples one folder rather than the library. Step count ascending
 * opens on six hundred one-node workflows, which is an accurate and
 * completely uninviting picture of what is here.
 *
 * So: rank by whether the workflow is worth opening. Its author having
 * written documentation dominates, because that is the difference between a
 * workflow you can learn from and a file you have to reverse-engineer. After
 * that, prefer a handful of services over one, and a size someone can read in
 * a sitting - about ten steps, penalised in both directions.
 */
export function featuredScore(entry: CatalogEntry): number {
  return (
    (entry.documented ? 100 : 0) +
    Math.min(entry.integrations.length, 4) * 6 -
    Math.abs(entry.steps - 10)
  )
}

/**
 * Moves anything that repeats a title or a summary behind the first of its
 * kind.
 *
 * Near-identical workflows score near-identically, so the featured order puts
 * them next to each other and the first screen reads as though it is
 * stuttering - even though both files are real and different. The summary
 * matters as much as the title here: two workflows called "Code Strava
 * Automation" and "Code Strava Send" have different names and the same three
 * lines of text under them, which is what a reader actually sees repeat.
 *
 * Nothing is removed. The entry that scored highest keeps the place it
 * earned, and its near-twins move below everything shown once.
 *
 * Only the unsearched view needs this. Once someone has typed a query, seeing
 * every near-match together is the point.
 */
function spreadRepeats<T extends { entry: CatalogEntry }>(items: T[]): T[] {
  const seenNames = new Set<string>()
  const seenSummaries = new Set<string>()
  const first: T[] = []
  const rest: T[] = []

  for (const item of items) {
    const name = item.entry.name.toLowerCase()
    const summary = item.entry.summary.toLowerCase()

    if (seenNames.has(name) || seenSummaries.has(summary)) {
      rest.push(item)
      continue
    }

    seenNames.add(name)
    seenSummaries.add(summary)
    first.push(item)
  }

  return first.concat(rest)
}

function passesFilters(entry: CatalogEntry, filters: Filters): boolean {
  if (filters.category && entry.category !== filters.category) return false
  if (filters.trigger && entry.trigger !== filters.trigger) return false
  if (filters.complexity && entry.complexity !== filters.complexity) return false
  if (filters.integration && !entry.integrations.includes(filters.integration)) return false
  return true
}

interface Match {
  entry: CatalogEntry
  score: number
  featured: number
}

/**
 * Everything that survives the filters and the query, unordered.
 *
 * Separate from the ranking because the facet counts need this and not that:
 * counting how many results an option would produce does not care what order
 * they come in, and there are four facets recounted on every keystroke. Doing
 * the sort inside made a single filter click pay for five of them.
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

    matches.push({ entry: item.entry, score, featured: item.featured })
  }

  return matches
}

/**
 * The filtered, ranked result list.
 *
 * Ties break on step count, ascending: given two equally relevant workflows,
 * the shorter one is the one worth reading first.
 */
export function searchCatalog(index: IndexedEntry[], filters: Filters, sort: SortKey = 'relevance'): CatalogEntry[] {
  const tokens = tokenize(filters.query)
  const scored = matchingEntries(index, filters, tokens)

  if (sort === 'name') {
    scored.sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  } else if (sort === 'steps') {
    scored.sort((a, b) => a.entry.steps - b.entry.steps || a.entry.name.localeCompare(b.entry.name))
  } else if (tokens.length === 0) {
    scored.sort((a, b) => b.featured - a.featured || a.entry.name.localeCompare(b.entry.name))
    return spreadRepeats(scored).map((item) => item.entry)
  } else {
    scored.sort((a, b) => b.score - a.score || a.entry.steps - b.entry.steps)
  }

  return scored.map((item) => item.entry)
}

/** How many results each option of a facet would produce, given the others. */
export function facetCounts(index: IndexedEntry[], filters: Filters, facet: keyof Filters): Map<string, number> {
  const relaxed = { ...filters, [facet]: '' }
  const counts = new Map<string, number>()

  for (const { entry } of matchingEntries(index, relaxed, tokenize(relaxed.query))) {
    const values =
      facet === 'integration'
        ? entry.integrations
        : [entry[facet as 'category' | 'trigger' | 'complexity'] as string]
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return counts
}

/** The services worth offering as filters, most common first. */
export function topIntegrations(entries: CatalogEntry[], limit: number): string[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const service of entry.integrations) counts.set(service, (counts.get(service) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([service]) => service)
}

export const TRIGGERS: Trigger[] = ['Webhook', 'Scheduled', 'Chat', 'Form', 'App event', 'Sub-workflow', 'Manual']
export const COMPLEXITIES: Complexity[] = ['Simple', 'Standard', 'Advanced']
