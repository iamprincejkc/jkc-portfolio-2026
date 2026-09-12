<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ApiEntry } from '~/utils/public-api/types'

/**
 * One API, opened.
 *
 * A native `<dialog>` opened with `showModal()`, which is what gets the focus
 * trap, the top layer and the inert background for free - every one of which
 * is a bug waiting to happen in a hand-rolled overlay. It is *styled* as a
 * drawer rather than a centred box, because on a page whose whole job is
 * scanning a list, sliding a panel in beside the list keeps the list where it
 * was.
 *
 * Closing is handled here rather than left to the browser. `props.entry` is
 * the source of truth for whether an API is open, and a gesture the browser
 * resolves on its own closes the element while leaving that state behind - a
 * panel that is gone from the screen and still open as far as the page, the
 * URL and the scroll lock are concerned.
 *
 * Nothing is fetched. Every field is already in the catalog, and the one
 * thing this page cannot know - what the API's endpoints look like - is
 * deliberately not invented. A plausible-looking `curl` line for an endpoint
 * nobody verified is worse than a link to the documentation.
 */
const props = defineProps<{ entry: ApiEntry | null; entries: ApiEntry[] }>()
const emit = defineEmits<{ close: []; open: [id: string]; category: [name: string] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Lenis smooth-scrolls the whole site from a wheel listener on the document,
 * which keeps moving the page behind a modal that is meant to have taken
 * over. Stopping it is also what puts `overflow: hidden` on the html element,
 * so the background cannot scroll at all while the panel is up.
 */
const { $lenis } = useNuxtApp() as { $lenis?: { start: () => void; stop: () => void } }

/**
 * `props.entry` is the single source of truth for whether this is open, and
 * the element's own open state and Lenis both follow from it.
 *
 * The alternative, hanging cleanup off the dialog's `close` event, is a trap:
 * if that event is ever missed, Lenis stays stopped and the page behind is
 * left permanently unscrollable with no way back. Deriving it means the worst
 * a missed event can do is leave a panel open.
 */
function sync(entry: ApiEntry | null) {
  const element = dialog.value
  if (!element) return

  copied.value = false

  if (!entry) {
    if (element.open) element.close()
    $lenis?.start()
    return
  }

  if (!element.open) element.showModal()
  $lenis?.stop()
  // A panel opened from a card in the middle of the list should not inherit
  // the scroll position of the one before it.
  element.querySelector('.pa-panel__body')?.scrollTo(0, 0)
}

watch(() => props.entry, sync)

/*
 * Run once on mount as well, because a shared link arrives with an API
 * already chosen: the catalog has to load before this component exists at
 * all, so by the time it mounts the entry is already set and no change is
 * ever coming.
 *
 * A watcher's `immediate` run does not cover this and was tried: it fires
 * during setup, before there is a dialog element, so `sync` returns early and
 * nothing opens it afterwards. The symptom is subtle - the panel's markup
 * renders with the right content and the dialog is simply never shown.
 */
onMounted(() => sync(props.entry))

/** Every closing gesture ends here, and the parent does the rest. */
function close() {
  emit('close')
}

/**
 * Escape, handled rather than left to the browser's own close request.
 *
 * `showModal()` already closes on Escape, but doing so only closes the
 * element - the state that says an API is open lives in the parent, and would
 * be left disagreeing with the screen. Handling the key means one path closes
 * this, whichever gesture started it.
 */
function onCancel(event: Event) {
  event.preventDefault()
  close()
}

/** A click on the backdrop is a click on the dialog itself, not its contents. */
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

async function copyUrl() {
  if (!props.entry) return
  try {
    await navigator.clipboard.writeText(props.entry.url)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard blocked, or no permission. The URL is on screen and
    // selectable, so there is still a way to get it.
  }
}

onBeforeUnmount(() => {
  clearTimeout(copyTimer)
  // A component torn down while open would otherwise leave the page locked.
  $lenis?.start()
})

/* ----------------------------------------------------------------
   What the three facts mean, spelled out
   ---------------------------------------------------------------- */

const access = computed(() => {
  const entry = props.entry
  if (!entry) return ''
  if (entry.auth === 'None') return 'Nothing. Call it and it answers.'
  if (entry.auth === 'API key') return 'An API key. Expect a signup form before you get one.'
  if (entry.auth === 'OAuth') return 'An OAuth flow, so you will need a registered app and a redirect URL.'
  return `A ${entry.authLabel ?? 'custom'} header on every request.`
})

const reach = computed(() => {
  const entry = props.entry
  if (!entry) return ''
  if (entry.cors === 'Yes') return 'Yes. It sends the CORS headers, so a page can fetch it directly.'
  if (entry.cors === 'No') return 'No. Calls from a page will be blocked; put it behind your own server.'
  return 'Nobody has recorded it upstream. Try it from a page - and be ready to proxy if it is refused.'
})

/**
 * Other APIs in the same category.
 *
 * The most common next question after "not this one" is "what else is there",
 * and the answer is one filter click away but nobody thinks to make it.
 * Browser-ready first, because that is the ordering the rest of the page
 * defends.
 */
const related = computed(() => {
  const entry = props.entry
  if (!entry) return []
  return props.entries
    .filter((other) => other.category === entry.category && other.id !== entry.id)
    .sort((a, b) => (b.ready ?? 0) - (a.ready ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 6)
})
</script>

<template>
  <dialog ref="dialog" class="pa-panel" aria-labelledby="pa-panel-name" @cancel="onCancel" @click="onClick">
    <!-- `data-lenis-prevent`: see the rail. Lenis eats the wheel otherwise. -->
    <div v-if="props.entry" class="pa-panel__inner" data-lenis-prevent>
      <header class="pa-panel__head">
        <button type="button" class="pa-panel__category" @click="emit('category', props.entry.category)">
          {{ props.entry.category }}
          <PublicApiIcon name="arrow" :size="12" />
        </button>
        <button type="button" class="pa-icon-button" aria-label="Close" @click="close">
          <PublicApiIcon name="close" :size="16" />
        </button>
      </header>

      <div class="pa-panel__body">
        <h2 id="pa-panel-name" class="pa-panel__name">{{ props.entry.name }}</h2>
        <p v-if="props.entry.description" class="pa-panel__desc">{{ props.entry.description }}</p>

        <p v-if="props.entry.ready" class="pa-panel__ready">
          <PublicApiIcon name="bolt" :size="13" />
          Browser-ready. No key, HTTPS, CORS allowed.
        </p>

        <PublicApiBadges :entry="props.entry" />

        <a class="pa-button" :href="props.entry.url" target="_blank" rel="noopener noreferrer">
          Read the documentation
          <PublicApiIcon name="external" :size="14" />
        </a>

        <div class="pa-url">
          <code class="pa-url__text">{{ props.entry.url }}</code>
          <button type="button" class="pa-icon-button" :aria-label="copied ? 'Copied' : 'Copy the URL'" @click="copyUrl">
            <PublicApiIcon :name="copied ? 'check' : 'copy'" :size="14" />
          </button>
        </div>
        <!-- Announced on change; the icon swap alone says nothing to a reader. -->
        <p class="pa-sr" role="status" aria-live="polite">{{ copied ? 'URL copied to the clipboard' : '' }}</p>

        <dl class="pa-facts">
          <dt>What it wants</dt>
          <dd>{{ access }}</dd>
          <dt>Callable from a page</dt>
          <dd>{{ reach }}</dd>
          <dt>Transport</dt>
          <dd>
            {{
              props.entry.https
                ? 'HTTPS. Safe to send a key over, as far as the transport goes.'
                : 'Plain HTTP only. Never send a key or anything personal to it.'
            }}
          </dd>
        </dl>

        <section v-if="related.length" class="pa-related">
          <h3 class="pa-eyebrow">More in {{ props.entry.category }}</h3>
          <ul>
            <li v-for="other in related" :key="other.id">
              <button type="button" @click="emit('open', other.id)">
                <span class="pa-related__name">
                  <PublicApiIcon v-if="other.ready" name="bolt" :size="10" />
                  {{ other.name }}
                </span>
                <PublicApiIcon name="chevron" :size="13" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </dialog>
</template>
