<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { loadWorkflow } from '~/composables/useN8nCatalog'
import type { LoadedWorkflow } from '~/composables/useN8nCatalog'
import type { CatalogEntry } from '~/utils/n8n/types'

/**
 * One workflow, opened.
 *
 * A native `<dialog>` opened with `showModal()`, which is what gets the focus
 * trap, the top layer and the inert background for free - every one of which
 * is a bug waiting to happen in a hand-rolled overlay.
 *
 * Closing, though, is handled here rather than left to the browser. `props.entry`
 * is the source of truth for whether a workflow is open, and a gesture the
 * browser resolves on its own closes the element while leaving that state
 * behind - a dialog that is gone from the screen and still open as far as the
 * page, the URL and the scroll lock are concerned.
 *
 * The workflow file is fetched when the dialog opens, not when the page loads.
 * There are two thousand of them; the browse experience must not wait on one.
 */
const props = defineProps<{ entry: CatalogEntry | null }>()
const emit = defineEmits<{ close: [] }>()

type Tab = 'diagram' | 'steps' | 'notes' | 'json'

const TABS: { value: Tab; label: string }[] = [
  { value: 'diagram', label: 'Diagram' },
  { value: 'steps', label: 'Steps' },
  { value: 'notes', label: 'Notes' },
  { value: 'json', label: 'JSON' },
]

const dialog = ref<HTMLDialogElement | null>(null)
const tab = ref<Tab>('diagram')
const loaded = shallowRef<LoadedWorkflow | null>(null)
const error = ref('')
const status = ref('')

const sizeLabel = computed(() => {
  const bytes = props.entry?.bytes ?? 0
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} kB`
})

/* ----------------------------------------------------------------
   Opening and closing
   ---------------------------------------------------------------- */

/**
 * Lenis smooth-scrolls the whole site from a wheel listener on the document,
 * which keeps moving the page behind a modal that is meant to have taken over.
 * Stopping it is also what puts `overflow: hidden` on the html element, so the
 * background cannot scroll at all while the dialog is up.
 */
const { $lenis } = useNuxtApp() as { $lenis?: { start: () => void; stop: () => void } }

/**
 * `props.entry` is the single source of truth for whether this is open, and
 * everything else follows from it - the element's own open state, Lenis, the
 * fetch.
 *
 * The alternative, hanging the cleanup off the dialog's `close` event, was
 * tried and is a trap: if that event is ever missed, Lenis stays stopped and
 * the page behind is left permanently unscrollable with no way back. Deriving
 * it means the worst a missed event can do is leave a dialog open.
 */
async function sync(entry: CatalogEntry | null) {
  const element = dialog.value
  if (!element) return

  if (!entry) {
    if (element.open) element.close()
    $lenis?.start()
    return
  }

  tab.value = 'diagram'
  loaded.value = null
  error.value = ''
  status.value = ''

  if (!element.open) element.showModal()
  $lenis?.stop()

  try {
    const result = await loadWorkflow(entry.id)
    // The reader may have moved on while this was in flight.
    if (props.entry?.id === entry.id) loaded.value = result
  } catch (cause) {
    if (props.entry?.id === entry.id) {
      error.value = cause instanceof Error ? cause.message : 'This workflow could not be loaded.'
    }
  }
}

watch(() => props.entry, sync)

/*
 * Run once on mount as well, because a shared link arrives with a workflow
 * already chosen: the catalog has to load before this component exists at all,
 * so by the time it mounts the entry is already set and no change is coming.
 * A watcher's `immediate` run would not do - it fires during setup, before
 * there is a dialog element to open.
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
 * element - the state that says a workflow is open lives in the parent, and
 * would be left disagreeing with the screen. Handling the key means one path
 * closes this, whichever gesture started it.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  close()
}

/**
 * Click-outside, done here rather than with `closedby="any"`.
 *
 * The attribute would close the element and leave the parent still holding a
 * workflow, which is the same divergence Escape had. Doing it by hand is also
 * one path instead of two: Safari has no `closedby` yet, so the fallback
 * would have to exist regardless, and a fallback that only some browsers take
 * is a fallback only some browsers test.
 *
 * The event target is the dialog itself both for a backdrop click and for a
 * click on the dialog's own padding, so the two are told apart by where the
 * pointer actually was.
 */
function onBackdropClick(event: MouseEvent) {
  const element = dialog.value
  if (!element || event.target !== element) return

  const box = element.getBoundingClientRect()
  const inside =
    event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
  if (!inside) close()
}

onBeforeUnmount(() => $lenis?.start())

/* ----------------------------------------------------------------
   Taking a copy
   ---------------------------------------------------------------- */
let statusTimer: ReturnType<typeof setTimeout> | undefined

function announce(message: string) {
  status.value = message
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => (status.value = ''), 2600)
}

function json(): string {
  return JSON.stringify(loaded.value?.workflow ?? {}, null, 2)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(json())
    announce('Copied. Paste it onto an n8n canvas.')
  } catch {
    // Insecure context, or a browser that refuses without a user gesture it
    // recognises. The JSON tab is still there to select by hand.
    announce('Could not reach the clipboard - use the JSON tab.')
  }
}

function download() {
  const blob = new Blob([json()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${props.entry?.id ?? 'workflow'}.json`
  link.click()
  URL.revokeObjectURL(url)
  announce('Downloaded.')
}

onBeforeUnmount(() => clearTimeout(statusTimer))
</script>

<template>
  <dialog
    ref="dialog"
    class="n8-dialog"
    aria-labelledby="n8-detail-title"
    @close="close"
    @keydown="onKeydown"
    @click="onBackdropClick"
  >
    <div v-if="props.entry" class="n8-detail">
      <header class="n8-detail__head">
        <div class="n8-detail__titles">
          <div>
            <p class="n8-eyebrow">{{ props.entry.category }}</p>
            <h2 id="n8-detail-title" class="n8-detail__title" tabindex="-1" autofocus>
              {{ props.entry.name }}
            </h2>
          </div>
          <button type="button" class="n8-close" aria-label="Close" @click="close">
            <N8nIcon name="close" />
          </button>
        </div>

        <p class="n8-detail__summary">{{ props.entry.summary }}</p>

        <div class="n8-detail__meta">
          <span class="n8-tag n8-tag--trigger">{{ props.entry.trigger }}</span>
          <span class="n8-tag n8-tag--steps">
            {{ props.entry.steps }} step{{ props.entry.steps === 1 ? '' : 's' }}
          </span>
          <span class="n8-tag">{{ props.entry.complexity }}</span>
          <span class="n8-tag">{{ sizeLabel }}</span>
          <span v-for="service in props.entry.integrations.slice(0, 6)" :key="service" class="n8-tag">
            {{ service }}
          </span>
        </div>
      </header>

      <div class="n8-detail__actions">
        <div class="n8-tabs" role="tablist" aria-label="Workflow views">
          <button
            v-for="option in TABS"
            :id="`n8-tab-${option.value}`"
            :key="option.value"
            type="button"
            role="tab"
            class="n8-tab"
            :aria-selected="tab === option.value"
            :aria-controls="`n8-panel-${option.value}`"
            :tabindex="tab === option.value ? undefined : -1"
            @click="tab = option.value"
          >
            {{ option.label }}
          </button>
        </div>

        <!-- Grouped, so a narrow dialog wraps the pair onto one new row
             instead of stacking one button per line. -->
        <div class="n8-detail__take">
          <button type="button" class="n8-button n8-button--primary" :disabled="!loaded" @click="copy">
            <N8nIcon name="copy" :size="18" />
            Copy JSON
          </button>
          <button type="button" class="n8-button" :disabled="!loaded" @click="download">
            <N8nIcon name="download" :size="18" />
            Download
          </button>
        </div>

      </div>

      <div
        :id="`n8-panel-${tab}`"
        class="n8-detail__panel"
        role="tabpanel"
        :aria-labelledby="`n8-tab-${tab}`"
        data-lenis-prevent
      >
        <div v-if="error" class="n8-note">
          <N8nIcon name="alert" :size="28" />
          <p class="n8-note__title">This one would not load</p>
          <p>{{ error }}</p>
        </div>

        <div v-else-if="!loaded" class="n8-note">
          <p class="n8-note__title">Loading the workflow…</p>
          <p>{{ sizeLabel }} of JSON, and its diagram.</p>
        </div>

        <N8nDiagram v-else-if="tab === 'diagram'" :detail="loaded.detail" :name="props.entry.name" />
        <N8nSteps v-else-if="tab === 'steps'" :detail="loaded.detail" />
        <N8nNotes v-else-if="tab === 'notes'" :notes="loaded.detail.notes" />
        <N8nJson v-else :workflow="loaded.workflow" />
      </div>

      <!--
        Both the announcement and the visible confirmation, in one element.
        Copying puts 20 kB on the clipboard and changes nothing on screen, so
        without this the button reads as broken - and a toast that only screen
        readers hear would be exactly as broken for everyone else.
      -->
      <p class="n8-toast" role="status" aria-live="polite" :data-visible="Boolean(status)">{{ status }}</p>
    </div>
  </dialog>
</template>
