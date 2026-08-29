<script setup lang="ts">
import { computed } from 'vue'
import { toPathData, type ShapeDef } from '~/utils/qr/shapes'

/**
 * The shape picker.
 *
 * Each swatch is the real shape, built by the same function the renderer
 * calls, not a hand-drawn approximation of it. Adding a shape to the library
 * therefore adds it to this grid with no second edit, and a swatch can never
 * drift out of sync with what it produces.
 */
const props = withDefaults(
  defineProps<{
    label: string
    modelValue: string
    shapes: readonly ShapeDef[]
    /** Corner radius to preview the shapes at, so the grid tracks the slider. */
    radius?: number
    /** Coordinate extent of the shape space: 1 for body modules, 7 for eyes. */
    extent?: number
  }>(),
  { radius: 0.5, extent: 1 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const swatches = computed(() =>
  props.shapes.map((shape) => ({
    id: shape.id,
    label: shape.label,
    d: toPathData([shape.build(props.radius)]),
  })),
)

const viewBox = computed(() => {
  const half = props.extent / 2
  const pad = props.extent * 0.06
  const side = props.extent + pad * 2
  return `${-half - pad} ${-half - pad} ${side} ${side}`
})
</script>

<template>
  <div>
    <span class="qr-label">{{ props.label }}</span>
    <div class="qr-tiles" role="group" :aria-label="props.label">
      <button
        v-for="swatch in swatches"
        :key="swatch.id"
        type="button"
        class="qr-tile"
        :title="swatch.label"
        :aria-label="swatch.label"
        :aria-pressed="swatch.id === props.modelValue"
        @click="emit('update:modelValue', swatch.id)"
      >
        <svg :viewBox="viewBox" aria-hidden="true">
          <path :d="swatch.d" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</template>
