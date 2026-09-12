/**
 * Generates the data behind `/public-api` from the upstream directory.
 *
 *   node scripts/build-public-api-catalog.mjs               download the pin
 *   node scripts/build-public-api-catalog.mjs --from <file> build from a file
 *   node scripts/build-public-api-catalog.mjs --ref <sha>   try another ref
 *
 * Writes one file, `public/public-api/catalog.json`, which is committed - so
 * the site has no build-time or run-time dependency on GitHub being
 * reachable, and a Netlify build never touches the network for this.
 *
 * ---------------------------------------------------------------------------
 * Why this is pinned to a commit
 * ---------------------------------------------------------------------------
 * `public-apis/public-apis` has no releases and no tags to hang a pin on, and
 * its README is edited by pull request several times a week. A build that
 * follows `master` would produce a different catalog on every run, so a
 * rebuild could silently drop entries and there would be nothing to diff
 * against. A commit SHA is immutable, so what is committed here is
 * reproducible from what is written down here.
 *
 * Moving the pin is a deliberate act: bump REF, run this, read the summary,
 * and check the diff of `catalog.json` is the size you expect. The guards
 * below refuse to write a catalog that has lost a tenth of the directory or
 * a fifth of its categories, because that is what a parser broken by an
 * upstream reformat looks like, and it looks exactly like a smaller
 * directory otherwise.
 *
 * Source: https://github.com/public-apis/public-apis (MIT). Every entry is
 * somebody else's work; this page only makes the index searchable, and always
 * links back to the documentation it came from.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * The parser lives in TypeScript so it can be unit-tested alongside the rest
 * of `utils/public-api/`, and this script imports it rather than duplicating
 * it. That relies on Node stripping the types on the fly, which is unflagged
 * from 22.18 onwards.
 *
 * Checked before the import rather than after, and reached by `await import`
 * rather than a static one, because a static import is evaluated before any
 * code in this file runs - so the check would come too late and the failure
 * would be an unresolved-module error that says nothing about the cause.
 *
 * Netlify never runs this script: the catalog is committed.
 */
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `This script needs Node 22.18 or newer to read TypeScript directly - you are on ${process.version}.\n` +
      'Upgrade Node, or run it with `node --experimental-strip-types`.',
  )
  process.exit(1)
}

const { parseReadme } = await import('../utils/public-api/parse.ts')

const REPO = 'public-apis/public-apis'

/** Pinned. See the note above before changing it. Merged 2026-09-10. */
const REF = '7ee71f04dd42720f7f4130aa70f804aa95c53164'

/*
 * What the pin held when it was last verified. The guards are expressed as a
 * fraction of these rather than as flat numbers, so they keep their meaning
 * as the directory grows.
 */
const EXPECTED_ENTRIES = 1773
const EXPECTED_CATEGORIES = 51

/** Below these, the parse is broken rather than the directory smaller. */
const MIN_ENTRY_RATIO = 0.9
const MIN_CATEGORY_RATIO = 0.8

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'public', 'public-api')
const OUT_FILE = join(OUT_DIR, 'catalog.json')

function arg(flag) {
  const at = process.argv.indexOf(flag)
  return at === -1 ? undefined : process.argv[at + 1]
}

const ref = arg('--ref') ?? REF

async function fetchReadme() {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/README.md`
  process.stdout.write(`Downloading ${REPO}@${ref.slice(0, 8)}... `)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${url}`)
  const markdown = await response.text()
  console.log(`${(markdown.length / 1024).toFixed(0)} kB`)
  return markdown
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

const from = arg('--from')
if (from && !existsSync(resolve(from))) throw new Error(`No such file: ${from}`)

const markdown = from ? readFileSync(resolve(from), 'utf8') : await fetchReadme()
const { entries, categories, skipped } = parseReadme(markdown)

/*
 * The guards. A README that has been reformatted upstream parses to a
 * plausible-looking fraction of itself rather than to an error, so the only
 * way to catch it is to insist on the shape.
 */
const problems = []

if (entries.length < EXPECTED_ENTRIES * MIN_ENTRY_RATIO) {
  problems.push(
    `only ${entries.length} entries parsed, expected at least ` +
      `${Math.round(EXPECTED_ENTRIES * MIN_ENTRY_RATIO)} (the pin held ${EXPECTED_ENTRIES})`,
  )
}

if (categories.length < EXPECTED_CATEGORIES * MIN_CATEGORY_RATIO) {
  problems.push(
    `only ${categories.length} categories parsed, expected at least ` +
      `${Math.round(EXPECTED_CATEGORIES * MIN_CATEGORY_RATIO)} (the pin held ${EXPECTED_CATEGORIES})`,
  )
}

// A handful of rows failing is a handful of malformed rows upstream. A tenth
// of them failing is this script no longer understanding the format.
if (skipped.length > entries.length * 0.01) {
  problems.push(`${skipped.length} rows looked like data and could not be read`)
}

const hostless = entries.filter((entry) => !entry.host)
if (hostless.length > entries.length * 0.01) {
  problems.push(`${hostless.length} entries have a URL that will not parse`)
}

if (problems.length) {
  console.error(
    `\nRefusing to write ${OUT_FILE}:\n` +
      problems.map((problem) => `  - ${problem}`).join('\n') +
      '\n\nUpstream has probably changed the README format. Read the note at the top of this script,\n' +
      'fix utils/public-api/parse.ts, and run its tests before trying again.\n',
  )
  if (skipped.length) console.error(`First unreadable rows:\n${skipped.slice(0, 5).map((r) => `  ${r}`).join('\n')}\n`)
  process.exit(1)
}

const catalog = {
  source: { repo: REPO, ref, generatedAt: new Date().toISOString().slice(0, 10) },
  categories,
  entries,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, JSON.stringify(catalog))

const ready = entries.filter((entry) => entry.ready).length
const noAuth = entries.filter((entry) => entry.auth === 'None').length
const insecure = entries.filter((entry) => !entry.https).length

console.log(`
  ref          ${REPO}@${ref.slice(0, 8)}
  published    ${entries.length} APIs across ${categories.length} categories
  no key       ${noAuth} (${((noAuth / entries.length) * 100).toFixed(0)}%)
  ready        ${ready} callable from a browser with no key, HTTPS and CORS
  http only    ${insecure}
  catalog      ${(statSync(OUT_FILE).size / 1024).toFixed(0)} kB
${skipped.length ? `  skipped      ${skipped.length} unreadable rows\n` : ''}${
  hostless.length ? `  hostless     ${hostless.length} entries with an unparseable URL\n` : ''
}`)
