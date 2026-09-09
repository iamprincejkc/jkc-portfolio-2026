/**
 * Generates the data behind `/n8n` from the upstream workflow collection.
 *
 *   node scripts/build-n8n-catalog.mjs              download the pinned ref
 *   node scripts/build-n8n-catalog.mjs --from <dir> build from a local clone
 *
 * Writes `public/n8n/catalog.json` (the browse index) and one
 * `public/n8n/workflows/<id>.json` per workflow (the diagram, the author's
 * notes, and the importable JSON). Both are committed, so the site has no
 * build-time or run-time dependency on GitHub being reachable.
 *
 * ---------------------------------------------------------------------------
 * Why this is pinned to a tag and not to `main`
 * ---------------------------------------------------------------------------
 * On 2025-11-03 an upstream commit titled "Fix: Comprehensive resolution of 18
 * issues" deleted 11,855 nodes it judged orphaned and left every edge that
 * pointed at them in place. The result is that on `main` today, 27,525 of the
 * 27,544 connections in the corpus point at nodes that do not exist - 0.1% of
 * the graph resolves. Every workflow still opens in a JSON viewer and every
 * workflow is broken: import one into n8n and you get a pile of disconnected
 * nodes.
 *
 * The `dmca-compliance-2025-08-14` tag predates that commit. There, 99.7% of
 * edges resolve. It is also a tag rather than a branch, so what it points at
 * cannot change under us.
 *
 * Verify before moving this pin, with the check that found it: parse every
 * workflow, resolve each connection endpoint against the node names in the
 * same file, and require the resolution rate to stay above 99%. A newer ref
 * that fails that check is worse data, however much newer it is.
 * ---------------------------------------------------------------------------
 *
 * Source: https://github.com/Zie619/n8n-workflows (MIT). The workflows are
 * other people's work, republished here under that licence and always shown
 * with a link back to the file they came from.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * The derivation lives in TypeScript so it can be unit-tested alongside the
 * rest of `utils/n8n/`, and this script imports it directly rather than
 * duplicating it. That relies on Node stripping the types on the fly, which
 * is unflagged from 22.18 onwards.
 *
 * Checked before the import rather than after, and reached by `await import`
 * rather than a static one, because a static import is evaluated before any
 * code in this file runs - so the check would come too late and the failure
 * would be an unresolved-module error that says nothing about the cause.
 *
 * Netlify never runs this script: the catalog is committed. Its build stays
 * on Node 20 quite happily.
 */
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `This script needs Node 22.18 or newer to read TypeScript directly - you are on ${process.version}.\n` +
      'Upgrade Node, or run it with `node --experimental-strip-types`.',
  )
  process.exit(1)
}

const { deriveWorkflow } = await import('../utils/n8n/derive.ts')

const REPO = 'Zie619/n8n-workflows'
const REF = 'dmca-compliance-2025-08-14'
const TARBALL = `https://codeload.github.com/${REPO}/tar.gz/refs/tags/${REF}`

/** Below this, the corpus is damaged and should not be published. See above. */
const MIN_EDGE_RESOLUTION = 0.99

/** What a workflow the upstream repo did not categorise is filed under. */
const UNCATEGORIZED = 'Uncategorized'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'public', 'n8n')
const OUT_WORKFLOWS = join(OUT_DIR, 'workflows')

/* --------------------------------------------------------------------------
   Getting the corpus
   -------------------------------------------------------------------------- */

/**
 * Downloads and extracts the pinned tag, caching both so a re-run costs
 * nothing. Extraction shells out to `tar`, which ships with Windows 10 1803+,
 * macOS and every Linux - a hand-rolled tar reader would be a hundred lines of
 * header parsing to avoid a binary that is already there.
 */
async function fetchCorpus() {
  const cache = join(tmpdir(), 'n8n-workflows-cache')
  const archive = join(cache, `${REF}.tar.gz`)
  const extracted = join(cache, `n8n-workflows-${REF}`)

  mkdirSync(cache, { recursive: true })

  if (!existsSync(archive)) {
    process.stdout.write(`Downloading ${REPO}@${REF}... `)
    const response = await fetch(TARBALL)
    if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${TARBALL}`)
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
    console.log(`${(statSync(archive).size / 1024 / 1024).toFixed(1)} MB`)
  }

  if (!existsSync(extracted)) {
    process.stdout.write('Extracting... ')
    try {
      execFileSync('tar', ['-xzf', archive, '-C', cache], { stdio: 'pipe' })
    } catch (error) {
      throw new Error(
        `Could not run \`tar\`. Extract ${archive} by hand and re-run with --from <dir>.\n${error.message}`,
      )
    }
    console.log('done')
  }

  return extracted
}

/* --------------------------------------------------------------------------
   Reading it
   -------------------------------------------------------------------------- */

/** Every `workflows/<folder>/<file>.json`, in a stable order. */
function listWorkflows(repoDir) {
  const base = join(repoDir, 'workflows')
  if (!existsSync(base)) throw new Error(`No workflows/ directory under ${repoDir}`)

  const files = []
  for (const folder of readdirSync(base).sort()) {
    const folderPath = join(base, folder)
    if (!statSync(folderPath).isDirectory()) continue
    for (const file of readdirSync(folderPath).sort()) {
      if (file.endsWith('.json')) files.push({ folder, file, path: join(folderPath, file) })
    }
  }
  return files
}

/**
 * The upstream repo's own categorisation, keyed by filename. It is the one
 * piece of curation in the corpus that a script cannot re-derive, so it is
 * read rather than guessed.
 *
 * Twenty-one of its rows carry an empty string rather than a category, which
 * has to be normalised here: an empty category survives all the way to the
 * filter rail, where it renders as a nameless chip that looks permanently
 * selected, because "" is also what "no filter" is stored as.
 */
function readCategories(repoDir) {
  const path = join(repoDir, 'context', 'search_categories.json')
  if (!existsSync(path)) return new Map()

  const rows = JSON.parse(readFileSync(path, 'utf8'))
  return new Map(rows.map((row) => [row.filename, String(row.category ?? '').trim() || UNCATEGORIZED]))
}

/* --------------------------------------------------------------------------
   Building
   -------------------------------------------------------------------------- */

function build(repoDir) {
  const files = listWorkflows(repoDir)
  const categories = readCategories(repoDir)

  const entries = []
  const workflows = []
  const skipped = []
  /*
   * The corpus carries the same workflow under two numbers 74 times over -
   * byte-identical files, not variations. Two rows with the same name and the
   * same diagram read as a rendering bug, so the second copy is dropped. The
   * file list is sorted, so which copy survives is stable across runs.
   */
  const seen = new Map()
  let duplicates = 0
  let edgeCount = 0
  let declaredEdges = 0
  let nodeCount = 0
  /*
   * Credentials their authors left inline. Reported rather than silently
   * cleaned: a corpus that suddenly needs four hundred redactions is telling
   * you something about the corpus.
   */
  let redactions = 0
  const redactedFiles = []

  for (const { folder, file, path } of files) {
    const source = readFileSync(path, 'utf8')
    const derived = deriveWorkflow(file, categories.get(file) ?? UNCATEGORIZED, source)

    if (!derived) {
      skipped.push(`${folder}/${file}`)
      continue
    }

    const fingerprint = createHash('sha1').update(JSON.stringify(derived.workflow)).digest('hex')
    if (seen.has(fingerprint)) {
      duplicates++
      continue
    }
    seen.set(fingerprint, derived.entry.id)

    if (derived.redactions > 0) {
      redactions += derived.redactions
      redactedFiles.push(`${file} (${derived.redactions})`)
    }

    entries.push(derived.entry)
    workflows.push({ id: derived.entry.id, workflow: derived.workflow })
    edgeCount += derived.detail.edges.length
    declaredEdges += countDeclaredEdges(derived.workflow)
    nodeCount += derived.detail.nodes.length
  }

  return {
    entries,
    workflows,
    skipped,
    duplicates,
    edgeCount,
    declaredEdges,
    nodeCount,
    redactions,
    redactedFiles,
    scanned: files.length,
  }
}

/**
 * How many connections a workflow claims to have, before any of them are
 * resolved against the nodes that are actually in the file.
 *
 * Counted per workflow inside the build loop rather than by walking the corpus
 * a second time: the two walks would cover different sets the moment anything
 * is skipped, and the ratio between them would then measure the skipping
 * rather than the data. That is not hypothetical - deduplication made this
 * check report 96.7% on a corpus that resolves at 99.3%.
 */
function countDeclaredEdges(workflow) {
  const connections = workflow?.connections
  if (!connections || typeof connections !== 'object') return 0

  let declared = 0
  for (const channels of Object.values(connections)) {
    if (!channels || typeof channels !== 'object') continue
    for (const outputs of Object.values(channels)) {
      if (!Array.isArray(outputs)) continue
      for (const output of outputs) if (Array.isArray(output)) declared += output.length
    }
  }
  return declared
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

function write({ entries, workflows }) {
  /*
   * Cleared rather than merged, so a workflow that leaves the corpus leaves
   * `public/` too. Stale files here would still be reachable by URL and would
   * still be served, long after nothing linked to them.
   */
  rmSync(OUT_WORKFLOWS, { recursive: true, force: true })
  mkdirSync(OUT_WORKFLOWS, { recursive: true })

  for (const { id, workflow } of workflows) {
    // Minified, and otherwise byte-for-byte the workflow n8n would import.
    writeFileSync(join(OUT_WORKFLOWS, `${id}.json`), JSON.stringify(workflow))
  }

  const catalog = {
    // Which corpus and which ref stay in this file, not in the published
    // catalog - they are facts about the build, not about the page.
    source: { generatedAt: new Date().toISOString().slice(0, 10) },
    categories: [...new Set(entries.map((entry) => entry.category))].sort(),
    entries,
  }
  writeFileSync(join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog))

  return {
    catalogBytes: statSync(join(OUT_DIR, 'catalog.json')).size,
    detailBytes: readdirSync(OUT_WORKFLOWS).reduce((sum, f) => sum + statSync(join(OUT_WORKFLOWS, f)).size, 0),
  }
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const fromFlag = process.argv.indexOf('--from')
const repoDir = fromFlag === -1 ? await fetchCorpus() : resolve(process.argv[fromFlag + 1] ?? '')

if (!existsSync(repoDir)) throw new Error(`No such directory: ${repoDir}`)
mkdirSync(OUT_DIR, { recursive: true })

const result = build(repoDir)

/*
 * The guard described at the top of this file: how many of the connections
 * the corpus declares actually land on a node that is in the same file.
 */
const resolution = result.declaredEdges === 0 ? 1 : result.edgeCount / result.declaredEdges

if (resolution < MIN_EDGE_RESOLUTION) {
  console.error(
    `\nRefusing to write: only ${(resolution * 100).toFixed(1)}% of ${result.declaredEdges} connections ` +
      `resolve to real nodes (need ${(MIN_EDGE_RESOLUTION * 100).toFixed(0)}%).\n` +
      'The corpus at this ref has a broken connection graph. Read the note at the top of this script.',
  )
  process.exit(1)
}

const sizes = write(result)

console.log(`
  ref          ${REPO}@${REF}
  scanned      ${result.scanned} files${result.skipped.length ? `, ${result.skipped.length} unparseable` : ''}${result.duplicates ? `, ${result.duplicates} exact duplicates` : ''}
  published    ${result.entries.length} workflows, ${result.nodeCount} nodes, ${result.edgeCount} edges
  edges        ${(resolution * 100).toFixed(1)}% of ${result.declaredEdges} declared connections resolve
  catalog      ${mb(sizes.catalogBytes)}
  workflows    ${mb(sizes.detailBytes)} across ${result.entries.length} files
`)

if (result.skipped.length) {
  console.log(`  skipped: ${result.skipped.join(', ')}\n`)
}

if (result.redactions > 0) {
  console.log(
    `  redacted ${result.redactions} credential${result.redactions === 1 ? '' : 's'} their authors left inline:\n` +
      result.redactedFiles.map((f) => `    ${f}`).join('\n') +
      '\n',
  )
}
