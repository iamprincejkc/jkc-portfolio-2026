<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Photo } from '../composables/useGallery'

/**
 * Full-bleed view of one frame, in a native <dialog>.
 *
 * Using the real element (opened with showModal) means the browser handles the
 * top layer, focus trapping, focus restore and Esc for free. `closedby="any"`
 * gives click-outside dismissal declaratively; Safari does not support it yet,
 * so a small fallback covers that.
 */

const props = defineProps<{ photo: Photo }>()

const { url } = useCloudinaryImage()
const dialog = ref<HTMLDialogElement | null>(null)
const open = ref(false)

let onClick: ((event: MouseEvent) => void) | undefined

function onClose() {
  open.value = false
}

onMounted(() => {
  const el = dialog.value
  if (!el) return

  el.addEventListener('close', onClose)

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    onClick = (event) => {
      if (event.target !== el) return
      const rect = el.getBoundingClientRect()
      const insideContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      if (!insideContent) el.close()
    }
    el.addEventListener('click', onClick)
  }
})

onBeforeUnmount(() => {
  const el = dialog.value
  if (!el) return
  el.removeEventListener('close', onClose)
  if (onClick) el.removeEventListener('click', onClick)
})

function show() {
  open.value = true
  dialog.value?.showModal()
}
</script>

<template>
  <button
    type="button"
    class="eyebrow hover:text-primary transition-colors duration-fast"
    @click="show"
  >
    Enlarge
  </button>

  <dialog
    ref="dialog"
    class="lightbox"
    closedby="any"
    :aria-label="`${props.photo.title}, full size`"
  >
    <div class="flex h-full w-full flex-col">
      <div class="flex items-center justify-between px-6 py-4">
        <p class="eyebrow truncate">{{ props.photo.title }}</p>
        <button
          type="button"
          class="eyebrow hover:text-primary transition-colors duration-fast"
          @click="dialog?.close()"
        >
          Close
        </button>
      </div>

      <div class="min-h-0 flex-1 px-6 pb-6">
        <!-- Mounted only while open, so the large source is never fetched for
             visitors who do not ask for it. -->
        <img
          v-if="open"
          :src="url(props.photo.publicId, 2560)"
          :alt="props.photo.alt"
          class="h-full w-full object-contain"
        />
      </div>
    </div>
  </dialog>
</template>
