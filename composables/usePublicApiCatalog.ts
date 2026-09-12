/**
 * Loading the public API directory.
 *
 * One file, one fetch, 456 kB of JSON that compresses to about 78 kB. Every
 * part of the page needs all of it - the search, the facet counts and the
 * detail panel all read the same rows - so there is nothing to split out and
 * no second request to make. It is held at module scope rather than in
 * component state, so navigating away and back does not pay for it twice.
 *
 * The fetch does not happen on the server. This route is prerendered, so
 * anything loaded during setup would be baked into the HTML on disk and would
 * then be stale from the next `npm run build`.
 *
 * `credentials: 'omit'` because the catalog is not behind the PIN gate and
 * should not carry the session cookie. It is public static JSON, and a
 * request that sends no credentials is one a shared cache can treat as public.
 */
import { buildIndex } from '~/utils/public-api/search'
import type { IndexedEntry } from '~/utils/public-api/search'
import type { CatalogFile } from '~/utils/public-api/types'

/** Shared across every component and every visit to the route. */
let catalogPromise: Promise<CatalogFile> | null = null

export function loadPublicApiCatalog(): Promise<CatalogFile> {
  catalogPromise ??= fetch('/public-api/catalog.json', { credentials: 'omit' })
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return response.json() as Promise<CatalogFile>
    })
    .catch((error) => {
      // Clear the memo so a retry is possible; a rejected promise cached
      // forever would make one flaky request permanent for the session.
      catalogPromise = null
      throw error
    })
  return catalogPromise
}

/**
 * The catalog, its search index, and the state of getting hold of it.
 *
 * Returns refs rather than a promise because the page has three distinct
 * things to render - a skeleton, the results, and a failure someone can retry
 * from - and a promise only distinguishes two of them.
 */
export function usePublicApiCatalog() {
  const catalog = shallowRef<CatalogFile | null>(null)
  const index = shallowRef<IndexedEntry[]>([])
  const error = ref('')
  const pending = ref(true)

  async function load() {
    pending.value = true
    error.value = ''
    try {
      const file = await loadPublicApiCatalog()
      catalog.value = file
      index.value = buildIndex(file.entries)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'The directory could not be loaded.'
    } finally {
      pending.value = false
    }
  }

  onMounted(load)

  return { catalog, index, error, pending, retry: load }
}
