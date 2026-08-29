<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * A range input with its value shown, and optional preset stops underneath.
 *
 * The filled part of the track is a CSS variable rather than a second element,
 * because `::-webkit-slider-runnable-track` cannot see a sibling's state.
 */
const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min?: number
    max?: number
    step?: number
    /** Turns the raw number into what the user reads, e.g. `80%`. */
    format?: (value: number) => string
    /** Quick-set buttons under the track. */
    stops?: number[]
  }>(),
  { min: 0, max: 1, step: 0.01 },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const display = computed(() =>
  props.format ? props.format(props.modelValue) : String(props.modelValue),
)

const fill = computed(() => {
  const span = props.max - props.min
  return `${span === 0 ? 0 : ((props.modelValue - props.min) / span) * 100}%`
})

// `useId` rather than a random string: the label must point at the same
// id on the server and on the client, or hydration tears the pairing apart.
const id = useId()
</script>

<template>
  <div>
    <div class="qr-slider__row">
      <label class="qr-label" :for="id">{{ props.label }}</label>
      <span class="qr-slider__value">{{ display }}</span>
    </div>
    <input
      :id="id"
      class="qr-slider"
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="props.modelValue"
      :style="{ '--qr-slider-fill': fill }"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
    <div v-if="props.stops?.length" class="qr-stops">
      <button
        v-for="stop in props.stops"
        :key="stop"
        type="button"
        class="qr-stop"
        :aria-pressed="Math.abs(stop - props.modelValue) < (props.step ?? 0.01) / 2"
        @click="emit('update:modelValue', stop)"
      >
        {{ props.format ? props.format(stop) : stop }}
      </button>
    </div>
  </div>
</template>
