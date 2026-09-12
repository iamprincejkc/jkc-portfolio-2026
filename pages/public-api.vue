<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PUBLIC_API_THEME_BOOT_SCRIPT, usePublicApiTheme } from '~/composables/usePublicApiTheme'
import { EMPTY_FILTERS, FACETS, searchCatalog } from '~/utils/public-api/search'
import type { Filters, SortKey } from '~/utils/public-api/search'
import type { ApiEntry } from '~/utils/public-api/types'

definePageMeta({ layout: 'tool', toolTitle: 'public APIs', toolTheme: 'paper' })

const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')

useHead({
  title: 'Public API directory',
  meta: [
    {
      name: 'description',
      content:
        'Search 1,773 free public APIs across 51 categories. Filter by what they need from you - no key, HTTPS, CORS - and find the ones you can call straight from a page.',
    },
  ],
  link: [
    { rel: 'canonical', href: `${siteUrl}/public-api` },
    /*
     * The catalog is deliberately not preloaded. `catalog.json` revalidates on
     * every visit, and a revalidating response is not served out of the
     * preload cache - the browser would fetch it twice, once for the preload
     * and once for the fetch that could not reuse it. This was measured on
     * /n8n and the preload was removed there for the same reason.
     */
  ],
  script: [
    /*
     * Runs before the first paint, and has to: the theme lives on the html
     * element, and applying it after hydration is a flash on every load for
     * anyone who chose the other one. `tagPosition` keeps it in the head of
     * the prerendered HTML, and it runs again on a client-side navigation
     * into this route.
     */
    { innerHTML: PUBLIC_API_THEME_BOOT_SCRIPT, tagPosition: 'head', type: 'text/javascript' },
  ],
})

const { catalog, index, error, pending, retry } = usePublicApiCatalog()

/* ----------------------------------------------------------------
   State

   All of it starts at its default, deliberately. This route is prerendered,
   so the HTML on disk is the unfiltered directory; seeding from the query
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
type View = 'cards' | 'rows'
const VIEW_KEY = 'public-api-view'
const view = ref<View>('cards')

const VIEWS: { value: View; label: string; icon: 'cards' | 'rows' }[] = [
  { value: 'cards', label: 'Card view', icon: 'cards' },
  { value: 'rows', label: 'List view', icon: 'rows' },
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
 * How many results exist at once.
 *
 * Not a technical limit - 1,773 cards is a slow page and, more to the point,
 * an unreadable one. The grid grows a screenful at a time and only when
 * asked: infinite scroll was tried on /n8n and one flick to the bottom fired
 * the observer five times over, which is exactly the "it loaded everything"
 * feeling it is supposed to avoid.
 */
const CARDS_PER_PAGE = 24
const visible = ref(CARDS_PER_PAGE)

/** A row is a third the height of a card, so a page of them is bigger. */
const pageSize = computed(() => (view.value === 'rows' ? 60 : CARDS_PER_PAGE))

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'relevance', label: 'Best match' },
  { value: 'name', label: 'A to Z' },
  { value: 'category', label: 'By category' },
]

/** Short query keys, so a shared link stays readable. */
const QUERY_KEYS: Record<string, keyof Filters> = {
  q: 'query',
  cat: 'category',
  auth: 'auth',
  cors: 'cors',
  ready: 'ready',
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
  if (typeof query.api === 'string') openId.value = query.api

  /*
   * Read after mount for the same reason as the query: the prerendered HTML
   * on disk is the card view, and seeding a stored preference during setup
   * would make the client's first render disagree with it.
   */
  try {
    const stored = localStorage.getItem(VIEW_KEY)
    if (stored === 'cards' || stored === 'rows') view.value = stored
  } catch {
    // Storage blocked. The default view is a perfectly good answer.
  }
})

/* ----------------------------------------------------------------
   Results
   ---------------------------------------------------------------- */
const results = computed<ApiEntry[]>(() => searchCatalog(index.value, filters.value, sort.value))
const shown = computed(() => results.value.slice(0, visible.value))
const remaining = computed(() => Math.max(0, results.value.length - visible.value))
const total = computed(() => catalog.value?.entries.length ?? 0)

const open = computed<ApiEntry | null>(
  () => (openId.value && catalog.value?.entries.find((entry) => entry.id === openId.value)) || null,
)

/**
 * A link to an API that is not in the catalog is a dead link, and leaving
 * `api` in the URL would keep it dead through every later share.
 */
watch([openId, catalog], ([id, file]) => {
  if (id && file && !file.entries.some((entry) => entry.id === id)) openId.value = ''
})

// Any change to what is being searched starts the list from the top again.
watch([filters, sort], () => (visible.value = pageSize.value), { deep: true })

/*
 * Switching to rows fills the extra room it just made, but never takes back
 * results someone had already asked for.
 */
watch(view, () => (visible.value = Math.max(visible.value, pageSize.value)))

const activeFilters = computed(
  () => FACETS.filter((facet) => filters.value[facet]).length + (filters.value.ready ? 1 : 0),
)

function reset() {
  // The query is what someone typed; clearing the filters should not throw it
  // away. Only the facets go.
  filters.value = { ...EMPTY_FILTERS, query: filters.value.query }
}

function clearAll() {
  filters.value = { ...EMPTY_FILTERS }
}

/** Jumping to a category from inside the panel: filter, and close the panel. */
function showCategory(name: string) {
  filters.value = { ...filters.value, category: name }
  openId.value = ''
  railOpen.value = false
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
      if (openId.value) query.api = openId.value
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
   Hero figures

   Counted from the catalog rather than written into the copy, because a
   number in prose is a number that goes stale the next time the pin moves.
   ---------------------------------------------------------------- */
const stats = computed(() => {
  const entries = catalog.value?.entries ?? []
  return [
    { value: entries.length, label: 'APIs indexed' },
    { value: catalog.value?.categories.length ?? 0, label: 'Categories' },
    { value: entries.filter((entry) => entry.ready).length, label: 'Browser-ready' },
  ]
})

const { toggle: toggleTheme } = usePublicApiTheme()
</script>

<template>
  <div class="pa-app">
    <!--
      The parallax hero.

      Three layers on one scroll timeline, each drifting at its own rate: the
      rules furthest back move least, the figure behind the copy moves most.
      It is decorative, so it is progressive enhancement - the `@supports`
      block in the stylesheet means a browser without scroll-driven
      animations gets the same hero, still. Nothing but `transform` and
      `opacity` is animated, and none of it runs under
      `prefers-reduced-motion`.
    -->
    <div class="pa-hero">
      <div class="pa-hero__layer pa-hero__rules" aria-hidden="true" />
      <div class="pa-hero__layer pa-hero__figure" aria-hidden="true">
        <span>{{ total ? total.toLocaleString() : '1,773' }}</span>
      </div>

      <div class="pa-hero__layer pa-hero__copy">
        <div class="pa-hero__top">
          <p class="pa-eyebrow">A directory of free APIs</p>
          <button type="button" class="pa-theme" aria-label="Switch between light and dark" @click="toggleTheme">
            <!--
              Both glyphs are always here and CSS shows one. Choosing in
              JavaScript would disagree with the prerendered HTML on the first
              frame - the one frame a theme control must not get wrong.
            -->
            <PublicApiIcon name="sun" class="pa-theme__sun" :size="15" />
            <PublicApiIcon name="moon" class="pa-theme__moon" :size="15" />
          </button>
        </div>

        <h1 class="pa-hero__title">
          Every public API worth<br />knowing about, in one<br /><em>searchable</em> index.
        </h1>

        <p class="pa-hero__lede">
          The community-curated <code>public-apis</code> list, parsed into something you can actually search. Filter by
          what an API wants from you before it answers, and find the ones a browser can call with no key and no proxy.
        </p>

        <dl class="pa-stats">
          <div v-for="stat in stats" :key="stat.label">
            <dt>{{ stat.label }}</dt>
            <dd>{{ stat.value ? stat.value.toLocaleString() : '—' }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="pa-shell">
      <div class="pa-searchbar">
        <div class="pa-search">
          <PublicApiIcon name="search" class="pa-search__icon" :size="17" />
          <input
            v-model="filters.query"
            class="pa-search__input"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            spellcheck="false"
            aria-label="Search the API directory"
            placeholder="Try weather, github, currency, nasa…"
          />
          <button
            v-if="filters.query"
            type="button"
            class="pa-icon-button"
            aria-label="Clear the search"
            @click="filters.query = ''"
          >
            <PublicApiIcon name="close" :size="15" />
          </button>
        </div>

        <div class="pa-searchbar__meta">
          <p class="pa-count" role="status" aria-live="polite">
            <template v-if="pending">Loading the directory…</template>
            <template v-else-if="error">The directory could not be loaded.</template>
            <template v-else>
              <strong>{{ results.length.toLocaleString() }}</strong>
              <span>of {{ total.toLocaleString() }}</span>
            </template>
          </p>

          <button
            type="button"
            class="pa-chip pa-rail-toggle"
            :aria-expanded="railOpen"
            aria-controls="pa-rail"
            @click="railOpen = !railOpen"
          >
            <PublicApiIcon name="filter" :size="14" />
            Filters
            <span v-if="activeFilters" class="pa-chip__count">{{ activeFilters }}</span>
          </button>

          <div class="pa-chips" role="group" aria-label="Sort results">
            <button
              v-for="option in SORTS"
              :key="option.value"
              type="button"
              class="pa-chip"
              :aria-pressed="sort === option.value"
              @click="sort = option.value"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="pa-views" role="group" aria-label="Result layout">
            <button
              v-for="option in VIEWS"
              :key="option.value"
              type="button"
              class="pa-view"
              :aria-pressed="view === option.value"
              :aria-label="option.label"
              :title="option.label"
              @click="setView(option.value)"
            >
              <PublicApiIcon :name="option.icon" :size="15" />
            </button>
          </div>
        </div>
      </div>

      <div class="pa-body">
        <!--
          Always rendered, shown by CSS. Whether the rail is visible is a
          question about the viewport, and `v-show` would have to be told the
          breakpoint in JavaScript to answer it - which then disagrees with
          the stylesheet the first time either one changes.
        -->
        <div id="pa-rail" class="pa-rail-host" :data-open="railOpen">
          <PublicApiFilters
            v-if="catalog"
            :categories="catalog.categories"
            :index="index"
            :filters="filters"
            @update:filters="filters = $event"
            @reset="reset"
          />
        </div>

        <div class="pa-results">
          <!--
            The results have no visible heading - the count in the search bar
            says what they are - but they need one all the same, or the
            document goes straight from the h1 to the h3 on every card and a
            reader navigating by heading cannot tell where the list begins.
          -->
          <h2 class="pa-sr">Matching APIs</h2>

          <!--
            Shaped like the cards it stands in for. A plain grey slab the size
            of a card reads as something broken; the same block with a rule, a
            title and two lines of text reads as one arriving.
          -->
          <div v-if="pending" class="pa-grid" aria-hidden="true">
            <div v-for="i in 9" :key="i" class="pa-skeleton">
              <span class="pa-skeleton__line pa-skeleton__line--eyebrow" />
              <span class="pa-skeleton__line pa-skeleton__line--title" />
              <span class="pa-skeleton__line" />
              <span class="pa-skeleton__line pa-skeleton__line--short" />
            </div>
          </div>

          <div v-else-if="error" class="pa-note">
            <PublicApiIcon name="alert" :size="24" />
            <p class="pa-note__title">The directory could not be loaded</p>
            <p>{{ error }}</p>
            <button type="button" class="pa-button" @click="retry">Try again</button>
          </div>

          <div v-else-if="results.length === 0" class="pa-note">
            <p class="pa-note__title">Nothing matches that</p>
            <p>
              Nearly two thousand APIs and not one of them fits. Try a single word - a subject usually finds more than a
              product name does.
            </p>
            <button type="button" class="pa-button" @click="clearAll">Clear the search</button>
          </div>

          <div v-else-if="view === 'rows'" class="pa-rows">
            <PublicApiRow v-for="entry in shown" :key="entry.id" :entry="entry" @open="openId = entry.id" />
          </div>

          <div v-else class="pa-grid">
            <PublicApiCard v-for="entry in shown" :key="entry.id" :entry="entry" @open="openId = entry.id" />
          </div>

          <div v-if="remaining > 0" class="pa-more">
            <button type="button" class="pa-button" @click="showMore">
              Show {{ Math.min(pageSize, remaining) }} more
              <span class="pa-chip__count">{{ remaining.toLocaleString() }} left</span>
            </button>
            <p class="pa-more__note">Searching gets there faster than scrolling.</p>
          </div>
        </div>
      </div>

      <footer v-if="catalog" class="pa-colophon">
        <p>
          {{ total.toLocaleString() }} APIs across {{ catalog.categories.length }} categories, parsed from the
          <a :href="`https://github.com/${catalog.source.repo}/tree/${catalog.source.ref}`" target="_blank" rel="noopener noreferrer">
            {{ catalog.source.repo }}
          </a>
          README as of {{ catalog.source.generatedAt }}. That list is other people's work, curated by hundreds of
          contributors and published under the MIT licence; this page only makes it searchable and links back to every
          entry's own documentation.
        </p>
        <p>
          The Auth, HTTPS and CORS columns are upstream's, and the CORS one is unverified for more than half the
          directory - shown here as <em>unverified</em> rather than quietly rounded down to no. Nothing on this page
          calls any of these APIs.
        </p>
      </footer>
    </div>

    <PublicApiDetail
      v-if="catalog"
      :entry="open"
      :entries="catalog.entries"
      @close="openId = ''"
      @open="openId = $event"
      @category="showCategory"
    />
  </div>
</template>
