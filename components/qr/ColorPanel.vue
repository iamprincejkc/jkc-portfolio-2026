<script setup lang="ts">
import { computed } from 'vue'
import { contrastRatio, type GradientMode, type QrStyle } from '~/utils/qr/render'

const props = defineProps<{ modelValue: QrStyle }>()
const emit = defineEmits<{ 'update:modelValue': [value: QrStyle] }>()

function patch(part: Partial<QrStyle>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

const GRADIENTS = [
  { value: 'none', label: 'None' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
] as const

/**
 * Shown next to the colours rather than buried in a warning, because contrast
 * is the single number that decides whether the code scans and people are
 * about to change the colours.
 */
const ratio = computed(() => {
  const fg = props.modelValue.gradient === 'none' ? props.modelValue.foreground : props.modelValue.gradientEnd
  return contrastRatio(fg, props.modelValue.background)
})

/**
 * One string rather than a chain of inline templates: Vue keeps the whitespace
 * between adjacent template blocks, which lands a space in front of the comma.
 */
const verdict = computed(() => {
  const value = ratio.value.toFixed(1)
  if (ratio.value >= 7) return `Contrast ${value}:1, comfortable`
  if (ratio.value >= 4) return `Contrast ${value}:1, usable`
  return `Contrast ${value}:1, risky`
})

/** Swaps the code and its background, keeping any gradient consistent. */
function invert() {
  patch({
    foreground: props.modelValue.background,
    background: props.modelValue.foreground,
    gradientStart: props.modelValue.background,
    bodyOutlineColor: props.modelValue.foreground,
    eyePupilOutlineColor: props.modelValue.foreground,
  })
}
</script>

<template>
  <div class="qr-stack">
    <div class="qr-grid-2">
      <QrSwatch
        label="Foreground"
        :model-value="props.modelValue.foreground"
        @update:model-value="patch({ foreground: $event, gradientStart: $event })"
      />
      <QrSwatch
        label="Background"
        :model-value="props.modelValue.background"
        @update:model-value="patch({ background: $event })"
      />
    </div>

    <div class="qr-slider__row">
      <span class="qr-hint" style="margin-top: 0">{{ verdict }}</span>
      <button type="button" class="qr-stop" style="padding-inline: 0.75rem" @click="invert">
        Swap
      </button>
    </div>

    <QrSegmented
      label="Body gradient"
      :model-value="props.modelValue.gradient"
      :options="GRADIENTS"
      @update:model-value="patch({ gradient: $event as GradientMode })"
    />

    <template v-if="props.modelValue.gradient !== 'none'">
      <div class="qr-grid-2">
        <QrSwatch
          label="Gradient start"
          :model-value="props.modelValue.gradientStart"
          @update:model-value="patch({ gradientStart: $event })"
        />
        <QrSwatch
          label="Gradient end"
          :model-value="props.modelValue.gradientEnd"
          @update:model-value="patch({ gradientEnd: $event })"
        />
      </div>

      <QrSlider
        v-if="props.modelValue.gradient === 'linear'"
        label="Angle"
        :model-value="props.modelValue.gradientAngle"
        :min="0"
        :max="360"
        :step="15"
        :format="(v) => `${v}°`"
        @update:model-value="patch({ gradientAngle: $event })"
      />
    </template>

    <label class="qr-check">
      <input
        type="checkbox"
        :checked="props.modelValue.separateEyeColors"
        @change="patch({ separateEyeColors: ($event.target as HTMLInputElement).checked })"
      />
      Give the eyes their own colours
    </label>

    <div v-if="props.modelValue.separateEyeColors" class="qr-grid-2">
      <QrSwatch
        label="Eye frame"
        :model-value="props.modelValue.eyeFrameColor"
        @update:model-value="patch({ eyeFrameColor: $event })"
      />
      <QrSwatch
        label="Eye pupil"
        :model-value="props.modelValue.eyePupilColor"
        @update:model-value="patch({ eyePupilColor: $event })"
      />
    </div>

    <label class="qr-check">
      <input
        type="checkbox"
        :checked="props.modelValue.bodyOutline"
        @change="patch({ bodyOutline: ($event.target as HTMLInputElement).checked })"
      />
      Outline each module
    </label>

    <QrSwatch
      v-if="props.modelValue.bodyOutline"
      label="Module outline"
      :model-value="props.modelValue.bodyOutlineColor"
      @update:model-value="patch({ bodyOutlineColor: $event })"
    />

    <label class="qr-check">
      <input
        type="checkbox"
        :checked="props.modelValue.eyePupilOutline"
        @change="patch({ eyePupilOutline: ($event.target as HTMLInputElement).checked })"
      />
      Outline the eye pupils
    </label>

    <QrSwatch
      v-if="props.modelValue.eyePupilOutline"
      label="Pupil outline"
      :model-value="props.modelValue.eyePupilOutlineColor"
      @update:model-value="patch({ eyePupilOutlineColor: $event })"
    />

    <QrSlider
      label="Quiet zone"
      :model-value="props.modelValue.margin"
      :min="0"
      :max="8"
      :step="1"
      :format="(v) => `${v} modules`"
      @update:model-value="patch({ margin: $event })"
    />

    <p v-if="props.modelValue.margin < 4" class="qr-notice qr-notice--warn">
      <QrIcon name="warning" />
      <span>The spec asks for four blank modules around the code. Below that, scanners start
        losing the edges against a busy background.</span>
    </p>
  </div>
</template>
