<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { buildScene, defaultStyle, scanRisk, type QrScene, type QrStyle } from '~/utils/qr/render'
import { buildPayload, PLACEHOLDER_PAYLOAD, type QrContent } from '~/utils/qr/payload'
import { sceneToSvg } from '~/utils/qr/export-svg'
import { exportScene, type ExportFormat } from '~/utils/qr/download'
import { randomizeStyle, STYLE_FACETS, type StyleFacet } from '~/utils/qr/randomize'
import { queryToState, stateToQuery } from '~/utils/qr/share'
import type { IconName } from '~/utils/qr/icon-paths'

definePageMeta({ layout: 'tool', toolTitle: 'QR generator' })

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')

useHead({
  title: 'QR code generator - Jan Kevin Cadampog',
  meta: [
    {
      name: 'description',
      content:
        'A free QR code generator that runs entirely in your browser. Shape, colour and brand the code, then download it as PNG, SVG, PDF or EPS.',
    },
  ],
  link: [{ rel: 'canonical', href: `${siteUrl}/qr-generator` }],
})

/* ----------------------------------------------------------------
   State

   Restored from the query string on first render so a shared link opens the
   same code. `route.query` is read once rather than watched: the URL is
   updated as the user edits, and reacting to our own writes would fight them.
   ---------------------------------------------------------------- */
const initial = queryToState(new URLSearchParams(route.query as Record<string, string>))
const style = ref<QrStyle>(initial.style)
const content = ref<QrContent>(initial.content)
const locked = ref<Set<StyleFacet>>(new Set())

const TABS: { value: string; label: string; icon: IconName }[] = [
  { value: 'content', label: 'Content', icon: 'content' },
  { value: 'shape', label: 'Shape', icon: 'shape' },
  { value: 'color', label: 'Colour', icon: 'color' },
  { value: 'logo', label: 'Logo', icon: 'logo' },
]
const tab = ref('content')

const KEEP_ICONS: Record<StyleFacet, IconName> = {
  shape: 'shape',
  rotation: 'rotate',
  eyes: 'eye',
  layout: 'layout',
  gradient: 'gradient',
  colors: 'color',
}

/* ----------------------------------------------------------------
   Derived
   ---------------------------------------------------------------- */
const payload = computed(() => buildPayload(content.value))
const hasContent = computed(() => payload.value.length > 0)

/**
 * An empty form still shows a code, so the styling controls have something to
 * act on before there is anything to encode. The downloads stay off until the
 * content is real.
 */
const scene = shallowRef<QrScene | null>(null)
const renderError = ref('')

watch(
  [payload, style],
  () => {
    try {
      scene.value = buildScene(payload.value || PLACEHOLDER_PAYLOAD, style.value)
      renderError.value = ''
    } catch (error) {
      // The only realistic failure is a payload past the largest QR version.
      scene.value = null
      renderError.value =
        error instanceof Error && /overflow|too long/i.test(error.message)
          ? 'That is more data than a QR code can hold. Shorten it, or link to it instead.'
          : 'That content could not be encoded.'
    }
  },
  { immediate: true, deep: true },
)

const svg = computed(() => (scene.value ? sceneToSvg(scene.value) : ''))
const risk = computed(() => scanRisk(style.value))

/* ----------------------------------------------------------------
   URL sync

   Debounced and written with `replace`, so typing a link does not fill the
   back button with one entry per keystroke.
   ---------------------------------------------------------------- */
const router = useRouter()
let syncTimer: ReturnType<typeof setTimeout> | undefined

watch(
  [style, content],
  () => {
    if (import.meta.server) return
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      router.replace({ query: Object.fromEntries(stateToQuery(style.value, content.value)) })
    }, 400)
  },
  { deep: true },
)

onUnmounted(() => clearTimeout(syncTimer))

/* ----------------------------------------------------------------
   Actions
   ---------------------------------------------------------------- */
function reroll() {
  style.value = randomizeStyle(style.value, { locked: locked.value })
}

function toggleLock(facet: StyleFacet) {
  const next = new Set(locked.value)
  if (next.has(facet)) next.delete(facet)
  else next.add(facet)
  locked.value = next
}

function reset() {
  style.value = defaultStyle()
  locked.value = new Set()
}

const SIZES = [512, 1024, 2048, 4096]
const pixelSize = ref(2048)

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'png', label: 'PNG', hint: 'Raster, for the web and for slides' },
  { id: 'svg', label: 'SVG', hint: 'Vector, editable in any design tool' },
  { id: 'pdf', label: 'PDF', hint: 'Vector, four inches square, ready to print' },
  { id: 'eps', label: 'EPS', hint: 'Vector, for print shops that ask for it' },
]

const busy = ref<ExportFormat | null>(null)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function say(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 3600)
}

onUnmounted(() => clearTimeout(toastTimer))

async function download(format: ExportFormat) {
  if (!scene.value || !hasContent.value || busy.value) return
  busy.value = format
  try {
    await exportScene({
      scene: scene.value,
      format,
      pixelSize: pixelSize.value,
      filename: `qr-${content.value.mode}-${Date.now().toString(36)}`,
    })
    say(`${format.toUpperCase()} downloaded.`)
  } catch (error) {
    say(error instanceof Error ? error.message : 'That download failed.')
  } finally {
    busy.value = null
  }
}

async function copyLink() {
  const query = stateToQuery(style.value, content.value).toString()
  /*
   * Built from the address the visitor is actually on, not from the canonical
   * site URL in config. Those differ on Netlify previews, on the raw
   * *.netlify.app host and on localhost, and a "copy link" that quietly
   * rewrites the origin hands back a URL to a different deployment.
   */
  const { origin, pathname } = window.location
  const url = `${origin}${pathname.replace(/\/$/, '')}?${query}`
  try {
    await navigator.clipboard.writeText(url)
    say('Link copied. It carries the style, but never a Wi-Fi password or an uploaded logo.')
  } catch {
    say('This browser blocked the clipboard. Copy the address bar instead.')
  }
}

/* ----------------------------------------------------------------
   Keyboard

   `R` rerolls, matching the badge on the button. Ignored while a field has
   focus, or the shortcut would eat the letter out of a URL.
   ---------------------------------------------------------------- */
function onKeydown(event: KeyboardEvent) {
  if (event.key.toLowerCase() !== 'r' || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable]')) return
  event.preventDefault()
  reroll()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="qr-app">
    <!-- The colour the glass refracts. -->
    <div class="qr-field" aria-hidden="true">
      <div class="qr-well qr-well--amber" />
      <div class="qr-well qr-well--violet" />
      <div class="qr-well qr-well--teal" />
      <div class="qr-well qr-well--rose" />
    </div>

    <div class="qr-shell">
      <div class="qr-centre">
        <QrPreview
          :svg="svg"
          :module-count="scene?.moduleCount ?? 0"
          :ecc="scene?.ecc ?? 'M'"
          :placeholder="!hasContent"
        />

        <!-- Reroll, and the locks that hold parts of the style still. -->
        <div class="glass-pill qr-reroll">
          <button type="button" class="qr-reroll__go" @click="reroll">
            <QrIcon name="sparkles" />
            Randomize
            <kbd class="qr-kbd">R</kbd>
          </button>

          <span class="qr-reroll__rule" aria-hidden="true" />

          <div class="qr-reroll__locks" role="group" aria-label="Keep when rerolling">
            <button
              v-for="facet in STYLE_FACETS"
              :key="facet.id"
              type="button"
              class="qr-lock"
              :title="`${locked.has(facet.id) ? 'Unlock' : 'Lock'} ${facet.label.toLowerCase()}`"
              :aria-label="`${locked.has(facet.id) ? 'Unlock' : 'Lock'} ${facet.label.toLowerCase()} when rerolling`"
              :aria-pressed="locked.has(facet.id)"
              @click="toggleLock(facet.id)"
            >
              <QrIcon :name="KEEP_ICONS[facet.id]" />
            </button>
          </div>

          <span class="qr-reroll__rule" aria-hidden="true" />

          <button type="button" class="qr-btn" @click="reset">Reset</button>
        </div>

        <p v-if="renderError" class="glass qr-notice qr-notice--bad qr-notice--floating">
          <QrIcon name="warning" />
          <span>{{ renderError }}</span>
        </p>
        <p v-else-if="!hasContent" class="qr-notice qr-notice--info qr-notice--floating">
          <QrIcon name="info" />
          <span>
            A placeholder, so the style controls have something to work on. Add your own content to
            turn the downloads on.
          </span>
        </p>
        <p v-else-if="risk" class="qr-notice qr-notice--floating" :class="`qr-notice--${risk.level}`">
          <QrIcon name="warning" />
          <span>{{ risk.message }}</span>
        </p>
      </div>
    </div>

    <!-- Export dock. Floating, centred over the stage. -->
    <div class="glass-pill qr-dock">
      <label class="qr-btn qr-dock__size">
        <QrIcon name="download" />
        <span class="qr-sr">PNG size</span>
        <select v-model.number="pixelSize" class="qr-dock__select" aria-label="PNG size in pixels">
          <option v-for="size in SIZES" :key="size" :value="size">{{ size }}px</option>
        </select>
      </label>

      <span class="qr-dock__rule" aria-hidden="true" />

      <button
        v-for="format in FORMATS"
        :key="format.id"
        type="button"
        class="qr-btn"
        :title="format.hint"
        :disabled="!hasContent || busy !== null"
        @click="download(format.id)"
      >
        {{ busy === format.id ? 'Saving' : format.label }}
      </button>

      <span class="qr-dock__rule" aria-hidden="true" />

      <button type="button" class="qr-btn" @click="copyLink">
        <QrIcon name="link" />
        Copy link
      </button>
    </div>

    <!-- Inspector. Floating and inset on all four sides at desktop widths. -->
    <aside class="glass qr-inspector">
      <div class="qr-inspector__head">
        <QrSegmented
          v-model="tab"
          :options="TABS"
          variant="tabs"
          panel-id="qr"
          label="Code settings"
        />
      </div>

      <!--
        `data-lenis-prevent` is required, not decorative. Lenis runs site-wide
        with `smoothWheel`, which swallows wheel events before they reach any
        inner scroller - so this panel would simply refuse to scroll while the
        page behind it moved instead.
      -->
      <div
        id="qr-panel"
        class="qr-inspector__body"
        data-lenis-prevent
        role="tabpanel"
        :aria-labelledby="`qr-tab-${tab}`"
      >
        <QrContentPanel v-if="tab === 'content'" v-model="content" v-model:qr-style="style" />
        <QrShapePanel v-else-if="tab === 'shape'" v-model="style" />
        <QrColorPanel v-else-if="tab === 'color'" v-model="style" />
        <QrLogoPanel v-else v-model="style" />
      </div>
    </aside>

    <!-- Live region for download and clipboard results. -->
    <p class="glass-pill qr-toast" role="status" aria-live="polite" :data-visible="Boolean(toast)">
      {{ toast }}
    </p>
  </div>
</template>

<style scoped>
.qr-centre {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 34rem;
}

/* The size picker is a button that happens to contain a select, so the chevron
   and label read as one control rather than as a form field in a toolbar. */
.qr-dock__size {
  position: relative;
  gap: 0.375rem;
  padding-right: 0.75rem;
  color: rgb(var(--qr-tint) / 0.72);
}

.qr-dock__select {
  appearance: none;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  padding: 0;
}

.qr-dock__select option {
  background: #16161c;
  color: #fff;
}

.qr-toast {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  z-index: 60;
  transform: translate(-50%, 1.25rem) scale(0.96);
  max-width: min(30rem, calc(100vw - 2rem));
  padding: 0.8125rem 1.25rem;
  color: #fff;
  font-size: 13px;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 320ms var(--qr-spring),
    transform 320ms var(--qr-spring);
}

.qr-toast[data-visible='true'] {
  opacity: 1;
  transform: translate(-50%, 0) scale(1);
}

/* Above the dock once the dock is pinned to the bottom of the viewport. */
@media (min-width: 1120px) {
  .qr-toast { bottom: 5.5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .qr-toast { transition-duration: 60ms; }
}
</style>
