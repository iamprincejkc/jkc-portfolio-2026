<script setup lang="ts">
import { computed } from 'vue'
import type { IconName } from '~/utils/qr/icon-paths'

/**
 * The iOS segmented control: a recessed track with one glass thumb that slides
 * between positions.
 *
 * The thumb is a single element positioned by a custom property rather than a
 * background applied to whichever option is active. That is the whole trick -
 * one element can travel, and travelling is what makes the control feel
 * physical instead of switching.
 *
 * Buttons with `aria-pressed` rather than radios: these apply immediately, and
 * screen readers announce the state without the grouping ceremony a radio set
 * needs. The `tabs` variant carries real tab semantics instead.
 */
const props = withDefaults(
  defineProps<{
    label?: string
    modelValue: string
    options: readonly { value: string; label: string; icon?: IconName }[]
    /**
     * `tabs` is taller, squarer, and announced as a tablist. It also takes its
     * label as an accessible name only - a heading over a row of tabs that
     * already say what they are is one label too many.
     */
    variant?: 'pills' | 'tabs'
    /** Only for `tabs`: prefix for the `aria-controls` panel id. */
    panelId?: string
  }>(),
  { variant: 'pills' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const index = computed(() => {
  const found = props.options.findIndex((o) => o.value === props.modelValue)
  return found < 0 ? 0 : found
})

const isTabs = computed(() => props.variant === 'tabs')
</script>

<template>
  <div>
    <span v-if="props.label && !isTabs" class="qr-label">{{ props.label }}</span>

    <div
      class="seg"
      :class="{ 'seg--tabs': isTabs }"
      :role="isTabs ? 'tablist' : 'group'"
      :aria-label="props.label"
      :style="{ '--seg-count': props.options.length, '--seg-index': index }"
    >
      <span class="seg__thumb" aria-hidden="true" />

      <button
        v-for="option in props.options"
        :id="isTabs && props.panelId ? `${props.panelId}-tab-${option.value}` : undefined"
        :key="option.value"
        type="button"
        class="seg__option"
        :role="isTabs ? 'tab' : undefined"
        :aria-selected="isTabs ? option.value === props.modelValue : undefined"
        :aria-pressed="isTabs ? undefined : option.value === props.modelValue"
        :aria-controls="isTabs && props.panelId ? `${props.panelId}-panel` : undefined"
        :tabindex="isTabs && option.value !== props.modelValue ? -1 : undefined"
        @click="emit('update:modelValue', option.value)"
      >
        <QrIcon v-if="option.icon" :name="option.icon" />
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
