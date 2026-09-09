<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { buildScene, NODE_SIZE } from '~/utils/n8n/graph'
import { bubbleInitials, KIND_COLOURS, KIND_LABELS } from '~/utils/n8n/palette'
import type { NodeKind, WorkflowDetail } from '~/utils/n8n/types'

/**
 * The workflow, drawn.
 *
 * Pan and zoom are done by transforming one group inside a viewBox that is
 * always the stage's own pixel size, rather than by animating the viewBox
 * itself. That makes one SVG unit one CSS pixel at scale 1, which is what
 * turns zoom-towards-the-cursor into two lines of arithmetic instead of a
 * coordinate-space conversion at every step.
 *
 * The diagram is an image, and is labelled as one. Everything in it is
 * available as text in the Steps tab next door, which is the accessible
 * equivalent rather than a consolation prize - it is also the faster way to
 * read a workflow with sixty nodes in it.
 */
const props = defineProps<{ detail: WorkflowDetail; name: string }>()

const MIN_SCALE = 0.08
const MAX_SCALE = 2.2

const stage = ref<HTMLElement | null>(null)
const size = ref({ width: 960, height: 560 })
const view = ref({ x: 0, y: 0, k: 1 })

const scene = shallowRef(buildScene(props.detail.nodes, props.detail.edges))

const transform = computed(() => `translate(${view.value.x} ${view.value.y}) scale(${view.value.k})`)

const kinds = computed(() => {
  const present = new Set<NodeKind>(scene.value.nodes.map((node) => node.kind))
  return (Object.keys(KIND_COLOURS) as NodeKind[]).filter((kind) => present.has(kind))
})

const label = computed(
  () =>
    `Diagram of ${props.name}: ${scene.value.nodes.length} steps connected by ${scene.value.edges.length} links. ` +
    'The Steps tab lists the same information as text.',
)

/** Fits the whole graph in the stage and centres it. */
function fit() {
  const { viewBox } = scene.value
  const { width, height } = size.value
  if (viewBox.width <= 0 || viewBox.height <= 0 || width <= 0) return

  const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(width / viewBox.width, height / viewBox.height)))
  view.value = {
    k,
    x: (width - viewBox.width * k) / 2 - viewBox.x * k,
    y: (height - viewBox.height * k) / 2 - viewBox.y * k,
  }
}

/** Zooms about a point given in stage pixels, so the point stays put. */
function zoomAt(px: number, py: number, factor: number) {
  const { x, y, k } = view.value
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, k * factor))
  if (next === k) return
  const ratio = next / k
  view.value = { k: next, x: px - (px - x) * ratio, y: py - (py - y) * ratio }
}

function zoomCentre(factor: number) {
  zoomAt(size.value.width / 2, size.value.height / 2, factor)
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  const box = stage.value?.getBoundingClientRect()
  if (!box) return
  /*
   * `deltaMode` matters: a mouse wheel reports lines, a trackpad reports
   * pixels, and treating a line as a pixel makes wheel zoom imperceptible.
   */
  const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
  zoomAt(event.clientX - box.left, event.clientY - box.top, Math.exp(-step * 0.0015))
}

let dragging = 0

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  dragging = event.pointerId
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (dragging !== event.pointerId) return
  view.value = {
    ...view.value,
    x: view.value.x + event.movementX,
    y: view.value.y + event.movementY,
  }
}

function onPointerUp(event: PointerEvent) {
  if (dragging !== event.pointerId) return
  dragging = 0
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

/** Arrow keys pan, plus and minus zoom - the stage is a real control. */
function onKeydown(event: KeyboardEvent) {
  const PAN = event.shiftKey ? 200 : 60
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [PAN, 0],
    ArrowRight: [-PAN, 0],
    ArrowUp: [0, PAN],
    ArrowDown: [0, -PAN],
  }

  if (moves[event.key]) {
    event.preventDefault()
    const [dx, dy] = moves[event.key]
    view.value = { ...view.value, x: view.value.x + dx, y: view.value.y + dy }
    return
  }

  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomCentre(1.25)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    zoomCentre(0.8)
  } else if (event.key === '0') {
    event.preventDefault()
    fit()
  }
}

/**
 * SVG text does not wrap and cannot be measured without laying it out, so
 * captions are cut to fit the room the layout says they have. The divisors
 * are the average advance width of DM Sans at each size - close enough that
 * a caption lands inside its slot, and cheap enough to do for every node on
 * every render.
 */
function clip(text: string, width: number, advance: number): string {
  const max = Math.max(6, Math.floor(width / advance))
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

/** The first line of a sticky note, as its caption on the canvas. */
function noteTitle(content: string, width: number): string {
  const line = content
    .split('\n')
    .map((row) => row.replace(/^\s*#{1,6}\s*/, '').trim())
    .find(Boolean)
  return clip(line ?? '', Math.max(60, width - 32), 6.6)
}

let observer: ResizeObserver | undefined
let fitted = false

onMounted(() => {
  if (!stage.value) return
  observer = new ResizeObserver(([entry]) => {
    const box = entry.contentRect
    if (box.width === 0) return
    size.value = { width: box.width, height: box.height }
    /*
     * Fit once, on the first measurement that is real. Refitting on every
     * resize would undo the reader's panning the moment they turned their
     * phone, and the tab switch that reveals this panel counts as a resize.
     */
    if (!fitted) {
      fitted = true
      fit()
    }
  })
  observer.observe(stage.value)
})

onBeforeUnmount(() => observer?.disconnect())

watch(
  () => props.detail,
  (detail) => {
    scene.value = buildScene(detail.nodes, detail.edges)
    fit()
  },
)
</script>

<template>
  <div
    ref="stage"
    class="n8-stage"
    tabindex="0"
    role="img"
    :aria-label="label"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
  >
    <svg :viewBox="`0 0 ${size.width} ${size.height}`" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="n8-node-shadow" x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#4a3482" flood-opacity="0.32" />
        </filter>
      </defs>

      <g :transform="transform">
        <!-- The author's sticky notes, behind everything, as they sit on the
             real canvas. Their text lives in the Notes tab; here they are
             spatial context, which is the part a list cannot give back. -->
        <g v-for="(note, i) in props.detail.notes" :key="`note-${i}`">
          <rect
            class="n8-notesheet"
            :x="note.x"
            :y="note.y"
            :width="Math.max(note.width, 40)"
            :height="Math.max(note.height, 40)"
            rx="16"
            opacity="0.85"
          />
          <text class="n8-notesheet__text" :x="note.x + 16" :y="note.y + 28">
            {{ noteTitle(note.content, Math.max(note.width, 40)) }}
          </text>
        </g>

        <path
          v-for="(edge, i) in scene.edges"
          :key="`edge-${i}`"
          class="n8-edge"
          :class="{ 'n8-edge--ai': edge.isAi }"
          :d="edge.d"
        />

        <g
          v-for="node in scene.nodes"
          :key="node.index"
          :class="{ 'n8-node--disabled': node.disabled }"
          :style="{ '--n8-node': KIND_COLOURS[node.kind] }"
        >
          <title>{{ node.name }} — {{ node.label }}</title>
          <rect class="n8-node__block" :x="node.x" :y="node.y" :width="NODE_SIZE" :height="NODE_SIZE" rx="28" />
          <text
            class="n8-node__glyph"
            :x="node.cx"
            :y="node.cy"
            text-anchor="middle"
            dominant-baseline="central"
            font-family="Nunito, system-ui, sans-serif"
            font-weight="800"
            font-size="30"
          >
            {{ bubbleInitials(node.label) }}
          </text>
          <text class="n8-node__label" :x="node.cx" :y="node.y + NODE_SIZE + 22">
            {{ clip(node.name, node.labelWidth, 7.7) }}
          </text>
          <text v-if="node.label !== node.name" class="n8-node__sub" :x="node.cx" :y="node.y + NODE_SIZE + 40">
            {{ clip(node.label, node.labelWidth, 6.4) }}
          </text>
        </g>
      </g>
    </svg>

    <div v-if="kinds.length" class="n8-stage__legend">
      <span v-for="kind in kinds" :key="kind">
        <i class="n8-legend__dot" :style="{ '--n8-dot': KIND_COLOURS[kind] }" />{{ KIND_LABELS[kind] }}
      </span>
    </div>

    <div class="n8-stage__controls">
      <button type="button" class="n8-stage__button" aria-label="Zoom out" @click="zoomCentre(0.8)">
        <N8nIcon name="minus" :size="18" />
      </button>
      <button type="button" class="n8-stage__button n8-stage__button--wide" @click="fit">
        {{ Math.round(view.k * 100) }}%
      </button>
      <button type="button" class="n8-stage__button" aria-label="Zoom in" @click="zoomCentre(1.25)">
        <N8nIcon name="plus" :size="18" />
      </button>
      <button type="button" class="n8-stage__button" aria-label="Fit to view" @click="fit">
        <N8nIcon name="fit" :size="18" />
      </button>
    </div>
  </div>
</template>
