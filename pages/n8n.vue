<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { THEME_BOOT_SCRIPT, useN8nTheme } from '~/composables/useN8nTheme'
import { EMPTY_FILTERS, searchCatalog } from '~/utils/n8n/search'
import type { Filters, SortKey } from '~/utils/n8n/search'
import type { CatalogEntry } from '~/utils/n8n/types'

definePageMeta({ layout: 'tool', toolTitle: 'n8n library', toolTheme: 'clay' })

const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')

useHead({
  title: 'n8n workflow library',
  meta: [
    {
      name: 'description',
      content:
        'Browse two thousand real n8n automation workflows. Search by service or trigger, read the diagram and the notes that came with it, then copy the JSON straight onto your canvas.',
    },
  ],
  link: [
    { rel: 'canonical', href: `${siteUrl}/n8n` },
    /*
     * The catalog is not preloaded, and that is a decision rather than an
     * omission.
     *
     * It used to be, which started the download about 125ms earlier. That
     * only worked while the file was freely cacheable. It now revalidates on
     * every visit - a stale catalog hands the page ids whose files no longer
     * exist - and a revalidating response is not served out of the preload
     * cache, so the browser made the request twice: once for the preload,
     * once for the fetch that could not reuse it.
     *
     * Both `crossorigin` settings and both fetch credentials modes were
     * tried. A duplicate request on every visit is a worse trade than a
     * slightly later start, and a correct catalog is worth more than either.
     */
    /*
     * Nunito and DM Sans are loaded here rather than in nuxt.config, so the
     * rest of the site does not pay for two typefaces it never renders. The
     * font files come from a second origin, which needs its own preconnect or
     * the handshake lands after the stylesheet has already resolved.
     */
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Nunito:wght@700;800&display=swap',
    },
  ],
  script: [
    /*
     * Runs before the first paint, and has to: the theme lives on the html
     * element, and applying it after hydration is a white flash on every
     * load for anyone who chose dark. `tagPosition` keeps it in the head of
     * the prerendered HTML, and it runs again on a client-side navigation
     * into this route.
     */
    { innerHTML: THEME_BOOT_SCRIPT, tagPosition: 'head', type: 'text/javascript' },
  ],
})

const { catalog, index, error, pending, retry } = useN8nCatalog()

/* ----------------------------------------------------------------
   State

   All of it starts at its default, deliberately. This route is prerendered,
   so the HTML on disk is the unfiltered library; seeding from the query
   during setup would make the client's first render disagree with that HTML,
   and Vue's hydration adopts the server DOM rather than re-rendering. The
   symptom is a shared link that opens on the wrong results and then fixes
   itself the moment you type. Restoring after mount keeps both renders
   identical and lets ordinary reactivity apply the link.
   ---------------------------------------------------------------- */
const filters = ref<Filters>({ ...EMPTY_FILTERS })
const sort = ref<SortKey>('relevance')
const openId = ref('')
const railOpen = ref(false)

/**
 * Cards to browse with, rows to look things up in.
 *
 * A personal preference rather than part of what a link says, so it is
 * remembered locally and deliberately kept out of the query string - sharing
 * a search should not impose how you like to read results.
 */
type View = 'cards' | 'compact'
const VIEW_KEY = 'n8n-view'
const view = ref<View>('cards')

const VIEWS: { value: View; label: string; icon: 'cards' | 'rows' }[] = [
  { value: 'cards', label: 'Card view', icon: 'cards' },
  { value: 'compact', label: 'Compact view', icon: 'rows' },
]

function setView(next: View) {
  view.value = next
  try {
    localStorage.setItem(VIEW_KEY, next)
  } catch {
    // Storage blocked. The choice still applies for this visit.
  }
}

/**
 * How many cards exist at once.
 *
 * Two thousand results is not a list, it is a denial of service against the
 * renderer: every card is a subtree, and mounting them all costs more than
 * anything the reader gets back. So the grid grows a screenful at a time,
 * and only when asked.
 *
 * It used to grow on scroll as well. That reads well in a description and
 * badly in the hand: one flick to the bottom fired the observer five times
 * over and left 120 cards and 1,800 nodes mounted, which is exactly the
 * "it loads everything" feeling infinite scroll is supposed to avoid. A
 * button costs one click and keeps the page the size the reader chose.
 */
const CARDS_PER_PAGE = 24
const visible = ref(CARDS_PER_PAGE)

/** A row is a quarter the height of a card, so a page of them is bigger. */
const pageSize = computed(() => (view.value === 'compact' ? 48 : CARDS_PER_PAGE))

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'steps', label: 'Smallest first' },
  { value: 'name', label: 'A to Z' },
]

/** Short query keys, so a shared link stays readable. */
const QUERY_KEYS: Record<string, keyof Filters> = {
  q: 'query',
  cat: 'category',
  trg: 'trigger',
  size: 'complexity',
  svc: 'integration',
}

const route = useRoute()
const router = useRouter()

onMounted(() => {
  /*
   * `route.query` rather than `window.location.search`: on a cold load of a
   * prerendered page the browser's own search string is momentarily empty
   * here, while the router has already parsed the real URL.
   */
  const query = route.query as Record<string, string | undefined>
  for (const [key, field] of Object.entries(QUERY_KEYS)) {
    if (typeof query[key] === 'string') filters.value[field] = query[key] as string
  }
  if (typeof query.w === 'string') openId.value = query.w

  /*
   * Read after mount for the same reason as the query: the prerendered HTML
   * on disk is the card view, and seeding a stored preference during setup
   * would make the client's first render disagree with it.
   */
  try {
    const stored = localStorage.getItem(VIEW_KEY)
    if (stored === 'cards' || stored === 'compact') view.value = stored
  } catch {
    // Storage blocked. The default view is a perfectly good answer.
  }
})

/* ----------------------------------------------------------------
   Results
   ---------------------------------------------------------------- */
const results = computed<CatalogEntry[]>(() => searchCatalog(index.value, filters.value, sort.value))
const shown = computed(() => results.value.slice(0, visible.value))
const remaining = computed(() => Math.max(0, results.value.length - visible.value))

const open = computed<CatalogEntry | null>(
  () => (openId.value && catalog.value?.entries.find((entry) => entry.id === openId.value)) || null,
)

/**
 * A link to a workflow that is not in the catalog is a dead link, and leaving
 * `w` in the URL would keep it dead through every later share.
 */
watch([openId, catalog], ([id, file]) => {
  if (id && file && !file.entries.some((entry) => entry.id === id)) openId.value = ''
})

// Any change to what is being searched starts the list from the top again.
watch([filters, sort], () => (visible.value = pageSize.value), { deep: true })

/*
 * Switching to compact fills the extra room it just made, but never takes
 * back results someone had already asked for.
 */
watch(view, () => (visible.value = Math.max(visible.value, pageSize.value)))

const activeFilters = computed(
  () => (['category', 'trigger', 'complexity', 'integration'] as const).filter((key) => filters.value[key]).length,
)

function reset() {
  filters.value = { ...EMPTY_FILTERS, query: filters.value.query }
}

/* ----------------------------------------------------------------
   URL sync

   Debounced and written with `replace`, so typing a search does not fill the
   back button with one entry per keystroke.
   ---------------------------------------------------------------- */
let syncTimer: ReturnType<typeof setTimeout> | undefined

watch(
  [filters, openId],
  () => {
    if (import.meta.server) return
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      const query: Record<string, string> = {}
      for (const [key, field] of Object.entries(QUERY_KEYS)) {
        if (filters.value[field]) query[key] = filters.value[field]
      }
      if (openId.value) query.w = openId.value
      router.replace({ query })
    }, 350)
  },
  { deep: true },
)

onUnmounted(() => clearTimeout(syncTimer))

function showMore() {
  visible.value += pageSize.value
}

/* ----------------------------------------------------------------
   Theme
   ---------------------------------------------------------------- */
const { toggle: toggleTheme } = useN8nTheme()
</script>

<template>
  <div class="n8-app">
    <div class="n8-shell">
      <header class="n8-hero">
        <div>
          <div class="n8-hero__top">
            <span class="n8-hero__mark" aria-hidden="true"><N8nIcon name="nodes" :size="34" /></span>

            <!--
              Both glyphs are always here and CSS shows one. Choosing in
              JavaScript would disagree with the prerendered HTML on the first
              frame - the one frame a theme control must not get wrong.
            -->
            <button type="button" class="n8-theme" aria-label="Switch between light and dark" @click="toggleTheme">
              <N8nIcon name="sun" class="n8-theme__sun" :size="22" />
              <N8nIcon name="moon" class="n8-theme__moon" :size="22" />
            </button>
          </div>

          <h1 class="n8-hero__title">The n8n workflow library</h1>
          <p class="n8-hero__lede">
            Two thousand real automations, in one searchable place. Read the diagram and the notes that came with each
            one, then take the JSON and paste it straight onto your own n8n canvas.
          </p>
        </div>
      </header>

      <div class="n8-searchbar">
        <div class="n8-search">
          <N8nIcon name="search" class="n8-search__icon" :size="22" />
          <input
            v-model="filters.query"
            class="n8-search__input"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search the workflow library"
            placeholder="Try slack, invoice, telegram, rag…"
          />
          <button
            v-if="filters.query"
            type="button"
            class="n8-search__clear"
            aria-label="Clear the search"
            @click="filters.query = ''"
          >
            <N8nIcon name="close" :size="18" />
          </button>
        </div>

        <div class="n8-searchbar__meta">
          <p role="status" aria-live="polite">
            <template v-if="pending">Loading the library…</template>
            <template v-else-if="error">The library could not be loaded.</template>
            <template v-else>
              <span class="n8-searchbar__count">{{ results.length.toLocaleString() }}</span>
              of {{ (catalog?.entries.length ?? 0).toLocaleString() }} workflows
            </template>
          </p>

          <div class="n8-rail-toggle">
            <button
              type="button"
              class="n8-chip"
              :aria-expanded="railOpen"
              aria-controls="n8-rail"
              @click="railOpen = !railOpen"
            >
              <N8nIcon name="filter" :size="16" />
              Filters
              <span v-if="activeFilters" class="n8-chip__count">{{ activeFilters }}</span>
            </button>
          </div>

          <div class="n8-chips" role="group" aria-label="Sort results">
            <button
              v-for="option in SORTS"
              :key="option.value"
              type="button"
              class="n8-chip"
              :aria-pressed="sort === option.value"
              @click="sort = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="n8-views" role="group" aria-label="Result layout">
            <button
              v-for="option in VIEWS"
              :key="option.value"
              type="button"
              class="n8-view"
              :aria-pressed="view === option.value"
              :aria-label="option.label"
              :title="option.label"
              @click="setView(option.value)"
            >
              <N8nIcon :name="option.icon" :size="18" />
            </button>
          </div>
        </div>
      </div>

      <div class="n8-body">
        <!--
          Always rendered, shown by CSS. Whether the rail is visible is a
          question about the viewport, and `v-show` would have to be told the
          breakpoint in JavaScript to answer it - which then disagrees with the
          stylesheet the first time either one changes.
        -->
        <div id="n8-rail" class="n8-rail-host" :data-open="railOpen">
          <N8nFilters
            v-if="catalog"
            :entries="catalog.entries"
            :index="index"
            :filters="filters"
            @update:filters="filters = $event"
            @reset="reset"
          />
        </div>

        <div>
          <!--
            Shaped like the cards it stands in for. A plain grey slab the
            size of a card reads as something broken; the same block with a
            bubble, a title and two lines of text reads as one arriving.
          -->
          <div v-if="pending" class="n8-grid" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="n8-skeleton">
              <span class="n8-skeleton__bubble" />
              <span class="n8-skeleton__line n8-skeleton__line--title" />
              <span class="n8-skeleton__line" />
              <span class="n8-skeleton__line n8-skeleton__line--short" />
            </div>
          </div>

          <div v-else-if="error" class="n8-note">
            <N8nIcon name="alert" :size="30" />
            <p class="n8-note__title">The library could not be loaded</p>
            <p>{{ error }}</p>
            <button type="button" class="n8-button" @click="retry">Try again</button>
          </div>

          <div v-else-if="results.length === 0" class="n8-note">
            <p class="n8-note__title">Nothing matches that</p>
            <p>
              Two thousand workflows and not one of them fits. Try a single word - a service name usually finds more
              than a description does.
            </p>
            <button v-if="activeFilters || filters.query" type="button" class="n8-button" @click="filters = { ...EMPTY_FILTERS }">
              Clear the search
            </button>
          </div>

          <div v-else-if="view === 'compact'" class="n8-rows">
            <N8nRow v-for="entry in shown" :key="entry.id" :entry="entry" @open="openId = entry.id" />
          </div>

          <div v-else class="n8-grid">
            <N8nCard v-for="entry in shown" :key="entry.id" :entry="entry" @open="openId = entry.id" />
          </div>

          <div v-if="remaining > 0" class="n8-more">
            <button type="button" class="n8-button" @click="showMore">
              Show {{ Math.min(pageSize, remaining) }} more
              <span class="n8-chip__count">{{ remaining.toLocaleString() }} left</span>
            </button>
            <p class="n8-more__note">Searching gets there faster than scrolling.</p>
          </div>
        </div>
      </div>

      <footer v-if="catalog" class="n8-colophon">
        <p>
          {{ catalog.entries.length.toLocaleString() }} workflows, indexed on {{ catalog.source.generatedAt }}. Every
          one is somebody else's work, published under the MIT licence; this page only makes them searchable. The
          names, summaries and diagrams are derived from the files themselves - where a workflow had no name, one is
          built from its filename, and where it had no description, the summary is the first note pinned to its canvas.
        </p>
      </footer>
    </div>

    <N8nDetail v-if="catalog" :entry="open" @close="openId = ''" />
  </div>
</template>
