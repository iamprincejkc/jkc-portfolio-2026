<script setup lang="ts">
import { ref } from 'vue'
import { BODY_SHAPES, EYE_FRAMES, EYE_PUPILS } from '~/utils/qr/shapes'
import type { JoinMode, QrStyle, RotationMode } from '~/utils/qr/render'

const props = defineProps<{ modelValue: QrStyle }>()
const emit = defineEmits<{ 'update:modelValue': [value: QrStyle] }>()

function patch(part: Partial<QrStyle>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

/**
 * Body and eyes are two separate jobs and the panel is long, so they get a
 * switch rather than a scroll. Same split the reference uses.
 */
const section = ref<'body' | 'eyes'>('body')

const SECTIONS = [
  { value: 'body', label: 'Body' },
  { value: 'eyes', label: 'Eyes' },
] as const

const JOINS = [
  { value: 'none', label: 'Separate' },
  { value: 'horizontal', label: 'Across' },
  { value: 'vertical', label: 'Down' },
  { value: 'both', label: 'Both' },
] as const

const ROTATIONS = [
  { value: 'none', label: 'None' },
  { value: 'random', label: 'Random' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'radial', label: 'Radial' },
  { value: 'wave', label: 'Wave' },
] as const

const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="qr-stack">
    <QrSegmented
      :model-value="section"
      :options="SECTIONS"
      label="Part of the code"
      @update:model-value="section = $event as 'body' | 'eyes'"
    />

    <template v-if="section === 'body'">
      <QrShapeGrid
        label="Module shape"
        :model-value="props.modelValue.bodyShape"
        :shapes="BODY_SHAPES"
        :radius="props.modelValue.cornerRadius"
        @update:model-value="patch({ bodyShape: $event })"
      />

      <QrSegmented
        label="Join neighbouring modules"
        :model-value="props.modelValue.join"
        :options="JOINS"
        @update:model-value="patch({ join: $event as JoinMode })"
      />

      <QrSlider
        label="Module thickness"
        :model-value="props.modelValue.thickness"
        :min="0.4"
        :max="1"
        :step="0.01"
        :format="percent"
        :stops="[0.5, 0.6, 0.7, 0.8, 0.9, 1]"
        @update:model-value="patch({ thickness: $event })"
      />

      <QrSlider
        label="Corner radius"
        :model-value="props.modelValue.cornerRadius"
        :format="percent"
        @update:model-value="patch({ cornerRadius: $event })"
      />

      <QrField label="Rotation" for="qr-rotation">
        <select
          id="qr-rotation"
          class="qr-select"
          :value="props.modelValue.rotation"
          @change="patch({ rotation: ($event.target as HTMLSelectElement).value as RotationMode })"
        >
          <option v-for="option in ROTATIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </QrField>

      <QrSlider
        v-if="props.modelValue.rotation !== 'none'"
        label="Rotation strength"
        :model-value="props.modelValue.rotationStrength"
        :format="percent"
        @update:model-value="patch({ rotationStrength: $event })"
      />

      <QrSlider
        label="Size jitter"
        :model-value="props.modelValue.jitter"
        :max="0.6"
        :format="percent"
        @update:model-value="patch({ jitter: $event })"
      />

      <p v-if="props.modelValue.join !== 'none'" class="qr-notice qr-notice--info">
        <QrIcon name="info" />
        <span>Joined modules are drawn as continuous bars, so rotation and jitter do not apply to them.</span>
      </p>
    </template>

    <template v-else>
      <QrShapeGrid
        label="Eye frame"
        :model-value="props.modelValue.eyeFrameShape"
        :shapes="EYE_FRAMES"
        :radius="props.modelValue.cornerRadius"
        :extent="7"
        @update:model-value="patch({ eyeFrameShape: $event })"
      />

      <QrShapeGrid
        label="Eye pupil"
        :model-value="props.modelValue.eyePupilShape"
        :shapes="EYE_PUPILS"
        :radius="props.modelValue.cornerRadius"
        :extent="3"
        @update:model-value="patch({ eyePupilShape: $event })"
      />

      <p class="qr-notice qr-notice--info">
        <QrIcon name="info" />
        <span>
          The three corner squares are how a scanner finds the code at all. They keep their
          proportions whatever shape you pick.
        </span>
      </p>
    </template>
  </div>
</template>
