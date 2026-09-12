/**
 * Turning the upstream README into the catalog.
 *
 * `public-apis/public-apis` has no data file - the README *is* the database,
 * about 250 kB of markdown holding one table per category. So this is a
 * parser, and it is written to fail loudly rather than quietly: the build
 * script asserts on the counts it returns, because a silent drop of half the
 * directory looks exactly like a smaller directory.
 *
 * It lives in TypeScript, next to its tests, rather than inside the build
 * script, so the derivation that produces the shipped data is the derivation
 * that is unit-tested. `scripts/build-public-api-catalog.mjs` imports it
 * directly.
 *
 * ---------------------------------------------------------------------------
 * How a section is recognised
 * ---------------------------------------------------------------------------
 * Not by name, and not by position. The README opens with two sponsor tables
 * that are shaped like the real ones - an `###` heading followed by a pipe
 * table - and an index of fifty links that is not a table at all. Matching on
 * "everything after `### Animals`" would work today and break the first time
 * upstream adds a category that sorts before it.
 *
 * The structural fact that separates a real section from a sponsor one is its
 * header row: only the directory tables declare `Auth`, `HTTPS` and `CORS`
 * columns. So a section opens on an `###` heading, arms when a header row
 * carrying those three columns appears beneath it, and closes at the next
 * heading or the first blank line after the table. Sponsor tables never arm,
 * and a new category upstream is picked up without touching this file.
 */
import type { ApiEntry, Auth, CategoryStat, Cors } from './types'

/** What upstream writes in the Auth cell, and what it means to a reader. */
const AUTH_ALIASES: Record<string, Auth> = {
  '': 'None',
  no: 'None',
  none: 'None',
  apikey: 'API key',
  'api key': 'API key',
  oauth: 'OAuth',
  'oauth 2.0': 'OAuth',
}

/**
 * Strips the markdown a description cell can carry.
 *
 * Descriptions are prose written by a thousand different contributors, so
 * they contain the occasional inline link, backtick or escaped pipe. None of
 * that survives into a catalog field that is rendered as text - a literal
 * `[Foo](https://…)` in a card is worse than no link at all.
 */
export function cleanText(cell: string): string {
  return cell
    .replace(/\\\|/g, '|')
    // An inline link becomes its own label; the href has nowhere to go here.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Most cells have no full stop and a handful do. Consistency is cheaper
    // to impose here than to work around in three different components.
    .replace(/\.$/, '')
}

/** A URL-safe, collision-resistant id. Stable across rebuilds. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      // Strip combining marks, so `Café` and `Cafe` do not become two ids.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'api'
  )
}

/**
 * The hostname, without `www.`.
 *
 * Shown on every card, so it is worth being right about: it is the only part
 * of the entry that says who is actually behind the API, and for the several
 * hundred entries whose name is a generic noun it is the whole answer.
 *
 * A URL that will not parse is not a reason to drop the entry - the link
 * still works for a human - so this degrades to an empty host and the build
 * script counts them.
 */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function toAuth(cell: string): { auth: Auth; authLabel?: string } {
  const raw = cleanText(cell)
  const known = AUTH_ALIASES[raw.toLowerCase()]
  if (known) return { auth: known }
  // `X-Mashape-Key`, `User-Agent`: a real mechanism, just an unusual one. The
  // bucket answers "do I need credentials", the label says which.
  return { auth: 'Other', authLabel: raw }
}

function toCors(cell: string): Cors {
  const raw = cleanText(cell).toLowerCase()
  if (raw === 'yes') return 'Yes'
  if (raw === 'no') return 'No'
  return 'Unknown'
}

/** A header row is the one that names the three columns only real tables have. */
function isDirectoryHeader(cells: string[]): boolean {
  const names = cells.map((cell) => cell.toLowerCase())
  return names.includes('auth') && names.includes('https') && names.includes('cors')
}

/** `|---|:---:|` and friends carry no data. */
function isSeparatorRow(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes('-')
}

/**
 * Splits a table row into its cells.
 *
 * Rows are written by hand and are inconsistent about their outer pipes -
 * some end `| Yes |`, some `| Yes | |`, some have no leading pipe at all - so
 * empty edge cells are dropped rather than counted.
 */
function splitRow(line: string): string[] {
  const cells = line.split('|').map((cell) => cell.trim())
  while (cells.length && cells[0] === '') cells.shift()
  while (cells.length && cells[cells.length - 1] === '') cells.pop()
  return cells
}

export interface ParseResult {
  entries: ApiEntry[]
  categories: CategoryStat[]
  /** Rows that looked like data and could not be read. Should stay at zero. */
  skipped: string[]
}

export function parseReadme(markdown: string): ParseResult {
  const entries: ApiEntry[] = []
  const skipped: string[] = []
  /** Ids already issued, so a repeated name inside a category still gets one. */
  const ids = new Set<string>()

  let category = ''
  let armed = false

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (heading) {
      // Only `###` opens a category. A `##` closes whatever was open, which
      // is what ends the last table before the licence footer.
      category = heading[1] === '###' ? cleanText(heading[2]) : ''
      armed = false
      continue
    }

    const trimmed = line.trim()

    if (!armed) {
      if (!category || !trimmed.includes('|')) continue
      if (isDirectoryHeader(splitRow(trimmed))) armed = true
      continue
    }

    // A blank line, or anything that is not a row, ends the table. The
    // "Back to Index" link that follows every section is the usual case.
    if (!trimmed.startsWith('|')) {
      if (trimmed) armed = false
      continue
    }
    if (isSeparatorRow(trimmed)) continue

    const cells = splitRow(trimmed)
    const link = /^\[([^\]]+)\]\(\s*([^)\s]+)\s*\)$/.exec(cells[0] ?? '')

    if (!link || cells.length < 5) {
      skipped.push(trimmed.slice(0, 160))
      continue
    }

    const name = cleanText(link[1])
    const url = link[2].startsWith('http') ? link[2] : `https://${link[2]}`
    const { auth, authLabel } = toAuth(cells[2])
    const https = cleanText(cells[3]).toLowerCase() === 'yes'
    const cors = toCors(cells[4])

    let id = `${slugify(category)}-${slugify(name)}`
    // Categories genuinely hold two APIs of the same name from different
    // providers - Animals has two "Cat Facts". Both are real entries, so the
    // second gets a suffix rather than overwriting the first.
    if (ids.has(id)) {
      let suffix = 2
      while (ids.has(`${id}-${suffix}`)) suffix++
      id = `${id}-${suffix}`
    }
    ids.add(id)

    const entry: ApiEntry = {
      id,
      name,
      description: cleanText(cells[1]),
      category,
      auth,
      https,
      cors,
      url,
      host: hostOf(url),
    }
    if (authLabel) entry.authLabel = authLabel
    if (auth === 'None' && https && cors === 'Yes') entry.ready = 1

    entries.push(entry)
  }

  return { entries, categories: summarise(entries), skipped }
}

/** Per-category totals, alphabetical - the order the filter rail renders in. */
export function summarise(entries: ApiEntry[]): CategoryStat[] {
  const stats = new Map<string, CategoryStat>()

  for (const entry of entries) {
    let stat = stats.get(entry.category)
    if (!stat) {
      stat = { name: entry.category, total: 0, ready: 0 }
      stats.set(entry.category, stat)
    }
    stat.total++
    if (entry.ready) stat.ready++
  }

  return [...stats.values()].sort((a, b) => a.name.localeCompare(b.name))
}
