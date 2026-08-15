<script setup lang="ts">
import { ref } from 'vue'
import type { Photo } from '../composables/useGallery'

/** Existing frames, with a two-step delete so one stray click cannot destroy work. */
defineProps<{ photos: Photo[] }>()
const emit = defineEmits<{ deleted: [] }>()

const { url } = useCloudinaryImage()

const confirming = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

async function confirmDelete(publicId: string) {
  busy.value = true
  error.value = null
  try {
    await $fetch('/api/gallery/admin/delete', { method: 'POST', body: { publicId } })
    confirming.value = null
    emit('deleted')
  } catch (caught: any) {
    error.value = caught?.data?.statusMessage || 'Delete failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="min-h-6" aria-live="polite">
      <p v-if="error" class="text-xs text-text-muted">{{ error }}</p>
    </div>

    <p v-if="photos.length === 0" class="eyebrow border-t border-border-muted py-16">
      No frames yet.
    </p>

    <ul v-else class="border-t border-border-muted">
      <li
        v-for="photo in photos"
        :key="photo.publicId"
        class="flex items-center gap-4 border-b border-border-muted py-4"
      >
        <div
          class="h-14 w-20 shrink-0 overflow-hidden"
          :style="{ backgroundColor: photo.color }"
        >
          <img
            :src="url(photo.publicId, 160)"
            alt=""
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover"
          />
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm">{{ photo.title }}</p>
          <p class="eyebrow truncate">{{ photo.tags.join(', ') || 'uncategorised' }}</p>
        </div>

        <div v-if="confirming === photo.publicId" class="flex shrink-0 items-center gap-3">
          <button
            type="button"
            :disabled="busy"
            class="eyebrow border border-accent px-3 py-2 !text-accent transition-colors duration-fast hover:bg-accent hover:!text-text-inverse disabled:opacity-40"
            @click="confirmDelete(photo.publicId)"
          >
            {{ busy ? 'Deleting' : 'Confirm' }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="eyebrow hover:text-primary transition-colors duration-fast disabled:opacity-40"
            @click="confirming = null"
          >
            Cancel
          </button>
        </div>
        <button
          v-else
          type="button"
          class="eyebrow shrink-0 hover:text-primary transition-colors duration-fast"
          @click="
            confirming = photo.publicId;
            error = null
          "
        >
          Delete
        </button>
      </li>
    </ul>
  </div>
</template>
