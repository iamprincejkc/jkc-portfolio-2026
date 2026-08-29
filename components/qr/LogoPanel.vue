<script setup lang="ts">
import { computed, ref } from 'vue'
import { BRAND_LOGOS, findBrandLogo } from '~/utils/qr/logos'
import type { QrStyle } from '~/utils/qr/render'

const props = defineProps<{ modelValue: QrStyle }>()
const emit = defineEmits<{ 'update:modelValue': [value: QrStyle] }>()

function patch(part: Partial<QrStyle>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const error = ref('')

/** Anything larger stops being a logo and starts being a payload. */
const MAX_BYTES = 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']

const brand = computed(() =>
  props.modelValue.logoId ? findBrandLogo(props.modelValue.logoId) : undefined,
)

const hasLogo = computed(() => Boolean(props.modelValue.logoId || props.modelValue.logoDataUrl))

function chooseBrand(id: string) {
  // Selecting a preset clears an upload; there is only one logo slot.
  patch({ logoId: props.modelValue.logoId === id ? null : id, logoDataUrl: null })
}

function readFile(file: File | undefined) {
  error.value = ''
  if (!file) return

  if (!ACCEPTED.includes(file.type)) {
    error.value = 'That file type will not render. Use PNG, JPEG, WebP, GIF or SVG.'
    return
  }
  if (file.size > MAX_BYTES) {
    error.value = 'That file is over 1 MB. A logo this small does not need to be.'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    // A data URL rather than an object URL: it has to survive being embedded
    // in the downloaded SVG, which an object URL would not.
    patch({ logoDataUrl: String(reader.result), logoId: null, matchLogoColor: false })
  }
  reader.onerror = () => {
    error.value = 'That file could not be read.'
  }
  reader.readAsDataURL(file)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  readFile(event.dataTransfer?.files?.[0])
}

function clearLogo() {
  patch({ logoId: null, logoDataUrl: null, matchLogoColor: false })
  if (fileInput.value) fileInput.value.value = ''
  error.value = ''
}

const percent = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <div class="qr-stack">
    <div>
      <span class="qr-label">Pick a mark</span>
      <div class="qr-tiles qr-tiles--logos" role="group" aria-label="Brand logos">
        <button
          v-for="logo in BRAND_LOGOS"
          :key="logo.id"
          type="button"
          class="qr-tile qr-tile--logo"
          :title="logo.title"
          :aria-label="logo.title"
          :aria-pressed="logo.id === props.modelValue.logoId"
          @click="chooseBrand(logo.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="logo.path" :fill="logo.hex === '#000000' ? 'currentColor' : logo.hex" />
          </svg>
        </button>
      </div>
      <p class="qr-hint">
        Marks are drawn as vectors, so they stay sharp in the SVG, PDF and EPS downloads.
      </p>
    </div>

    <div>
      <span class="qr-label">Or use your own</span>
      <label
        class="qr-drop"
        :data-dragging="dragging"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <QrIcon name="upload" />
        <span>{{ props.modelValue.logoDataUrl ? 'Replace the uploaded logo' : 'Drop a file, or click to browse' }}</span>
        <span class="qr-hint" style="margin: 0">PNG, JPEG, WebP, GIF or SVG, up to 1 MB</span>
        <input
          ref="fileInput"
          type="file"
          class="qr-sr"
          :accept="ACCEPTED.join(',')"
          @change="readFile(($event.target as HTMLInputElement).files?.[0])"
        />
      </label>
      <p class="qr-hint">
        The file never leaves this browser. It is read locally and drawn straight into the code.
      </p>
    </div>

    <p v-if="error" class="qr-notice qr-notice--bad">
      <QrIcon name="warning" />
      <span>{{ error }}</span>
    </p>

    <template v-if="hasLogo">
      <div class="qr-slider__row">
        <span class="qr-label" style="margin: 0">
          {{ brand ? brand.title : 'Uploaded logo' }}, centred
        </span>
        <button type="button" class="qr-stop" style="padding-inline: 0.75rem" @click="clearLogo">
          Remove
        </button>
      </div>

      <label v-if="brand" class="qr-check">
        <input
          type="checkbox"
          :checked="props.modelValue.matchLogoColor"
          @change="patch({ matchLogoColor: ($event.target as HTMLInputElement).checked })"
        />
        <span
          aria-hidden="true"
          style="width: 18px; height: 18px; border-radius: 5px; flex: none"
          :style="{ background: brand.hex }"
        />
        Paint the code in {{ brand.hex.toUpperCase() }}
      </label>

      <QrSlider
        label="Logo size"
        :model-value="props.modelValue.logoSize"
        :min="0.08"
        :max="0.32"
        :step="0.01"
        :format="percent"
        @update:model-value="patch({ logoSize: $event })"
      />

      <p class="qr-notice qr-notice--info">
        <QrIcon name="info" />
        <span>
          Modules under the logo are cleared rather than covered, and error correction is raised to
          at least Q so the code still reads.
        </span>
      </p>
    </template>
  </div>
</template>
