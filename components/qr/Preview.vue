<script setup lang="ts">
import { computed } from 'vue'
import { sceneToSvgParts } from '~/utils/qr/export-svg'
import type { QrScene } from '~/utils/qr/render'

const props = defineProps<{
  scene: QrScene | null
  /** True while the code encodes the stand-in rather than the user's content. */
  placeholder?: boolean
}>()

/*
 * Rendered as real elements rather than through `v-html`.
 *
 * The serialised code runs to around 56 kB of markup. Handing that to `v-html`
 * on every keystroke and every slider tick made the browser tear down and
 * re-parse several hundred DOM nodes each time, which is what made dragging a
 * slider feel heavy. There are only ever three to five paths in a scene, so
 * letting Vue own them means an update patches a handful of `d` attributes and
 * nothing is destroyed at all.
 *
 * The parts come from the same function the SVG download serialises, so the
 * preview cannot drift from the file you save.
 */
const parts = computed(() => (props.scene ? sceneToSvgParts(props.scene) : null))
</script>

<template>
  <div class="qr-stage">
    <div v-if="parts" class="glass qr-slab">
      <div
        class="qr-slab__inner"
        role="img"
        :aria-label="
          props.placeholder
            ? 'Placeholder QR code, showing the current style'
            : 'Live preview of your QR code'
        "
      >
        <svg
          :viewBox="`0 0 ${parts.size} ${parts.size}`"
          xmlns="http://www.w3.org/2000/svg"
          shape-rendering="geometricPrecision"
        >
          <defs v-if="parts.gradients.length">
            <template v-for="g in parts.gradients" :key="g.id">
              <linearGradient
                v-if="g.kind === 'linear'"
                :id="g.id"
                gradientUnits="userSpaceOnUse"
                :x1="g.x1"
                :y1="g.y1"
                :x2="g.x2"
                :y2="g.y2"
              >
                <stop offset="0" :stop-color="g.from" />
                <stop offset="1" :stop-color="g.to" />
              </linearGradient>
              <radialGradient
                v-else
                :id="g.id"
                gradientUnits="userSpaceOnUse"
                :cx="g.cx"
                :cy="g.cy"
                :r="g.r"
              >
                <stop offset="0" :stop-color="g.from" />
                <stop offset="1" :stop-color="g.to" />
              </radialGradient>
            </template>
          </defs>

          <rect :width="parts.size" :height="parts.size" :fill="parts.background" />

          <path
            v-for="path in parts.paths"
            :key="path.id"
            :d="path.d"
            :fill="path.fill"
            :stroke="path.stroke"
            :stroke-width="path.strokeWidth"
            :stroke-linejoin="path.stroke ? 'round' : undefined"
            :paint-order="path.stroke ? 'stroke' : undefined"
          />

          <image
            v-if="parts.image"
            :href="parts.image.href"
            :x="parts.image.x"
            :y="parts.image.y"
            :width="parts.image.width"
            :height="parts.image.height"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      </div>
    </div>

    <div v-else class="glass qr-slab qr-slab--empty">
      <div>
        <p class="font-display" style="font-size: 24px">Nothing to encode yet</p>
        <p class="qr-hint">
          A link, a network, an event or a contact. The code appears as you type.
        </p>
      </div>
    </div>

    <p v-if="parts" class="qr-meta">
      <span v-if="props.placeholder" class="qr-meta__badge">Placeholder</span>
      <span v-else>{{ props.scene!.moduleCount }} &times; {{ props.scene!.moduleCount }} modules</span>
      <span aria-hidden="true">&middot;</span>
      <span>error correction {{ props.scene!.ecc }}</span>
    </p>
  </div>
</template>
