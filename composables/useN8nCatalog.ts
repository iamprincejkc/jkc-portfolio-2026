/**
 * Loading the workflow library.
 *
 * Two files, two lifetimes. The catalog is one 800 kB fetch that every part of
 * the page needs, so it is loaded once and kept for as long as the tab lives -
 * held at module scope rather than in component state, so navigating away and
 * back does not pay for it twice.
 *
 * Each workflow is its own file, fetched when someone opens it. There are two
 * thousand of them and 20 MB in total, which is exactly why they are not in
 * the catalog: the browse experience should not wait on data that only matters
 * once you have chosen something.
 *
 * Neither fetch happens on the server. This route is prerendered, so anything
 * loaded during setup would be baked into the HTML on disk - 800 kB of it -
 * and would then be stale from the next `npm run build`.
 */
import { buildDetail } from '~/utils/n8n/derive'
import type { RawWorkflow } from '~/utils/n8n/derive'
import { buildIndex } from '~/utils/n8n/search'
import type { IndexedEntry } from '~/utils/n8n/search'
import type { CatalogFile, WorkflowDetail } from '~/utils/n8n/types'

export interface LoadedWorkflow {
  detail: WorkflowDetail
  /** The importable workflow, exactly as it is stored. */
  workflow: RawWorkflow
}

/** Shared across every component and every visit to the route. */
let catalogPromise: Promise<CatalogFile> | null = null
const workflows = new Map<string, Promise<LoadedWorkflow>>()

/**
 * `credentials: 'omit'` because none of these files are behind the PIN gate
 * and none of them should carry the session cookie. They are public static
 * JSON, and a request that sends no credentials is one a shared cache can
 * treat as public.
 */
async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return (await response.json()) as T
}

export function loadCatalog(): Promise<CatalogFile> {
  catalogPromise ??= fetchJson<CatalogFile>('/n8n/catalog.json').catch((error) => {
    // Clear the memo so a retry is possible; a rejected promise cached
    // forever would make one flaky request permanent for the session.
    catalogPromise = null
    throw error
  })
  return catalogPromise
}

export function loadWorkflow(id: string): Promise<LoadedWorkflow> {
  let pending = workflows.get(id)
  if (!pending) {
    pending = fetchJson<RawWorkflow>(`/n8n/workflows/${encodeURIComponent(id)}.json`)
      .then((workflow) => ({ workflow, detail: buildDetail(workflow) }))
      .catch((error) => {
        workflows.delete(id)
        throw error
      })
    workflows.set(id, pending)
  }
  return pending
}

/**
 * The catalog, its search index, and the state of getting hold of it.
 *
 * Returns refs rather than a promise because the page has three distinct
 * things to render - a skeleton, the results, and a failure someone can retry
 * from - and a promise only distinguishes two of them.
 */
export function useN8nCatalog() {
  const catalog = shallowRef<CatalogFile | null>(null)
  const index = shallowRef<IndexedEntry[]>([])
  const error = ref('')
  const pending = ref(true)

  async function load() {
    pending.value = true
    error.value = ''
    try {
      const file = await loadCatalog()
      catalog.value = file
      index.value = buildIndex(file.entries)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'The library could not be loaded.'
    } finally {
      pending.value = false
    }
  }

  onMounted(load)

  return { catalog, index, error, pending, retry: load }
}
