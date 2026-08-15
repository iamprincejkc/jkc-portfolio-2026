<script setup lang="ts">
import { ref } from 'vue'
import type { Photo } from '../composables/useGallery'

/** Existing frames, with a two-step delete so one stray click cannot destroy work. */
defineProps<{ photos: Photo[] }>()
const emit = defineEmits<{ deleted: [] }>()

const { posterFor } = useCloudinaryImage()

const confirming = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

async function confirmDelete(publicId: string, kind: 'image' | 'video') {
  busy.value = true
  error.value = null
  try {
    await $fetch('/api/gallery/admin/delete', { method: 'POST', body: { publicId, kind } })
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
          <!-- 160px for an 80px slot: correct for 2x, and small enough that a
               srcset ladder would cost more in markup than it saves. -->
          <img
            :src="posterFor(photo, 160)"
            alt=""
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover"
          />
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm">
            {{ photo.title }}
            <!-- Uploaded and stored, but filtered out of the public feed.
                 Listed here so it stays deletable. -->
            <span
              v-if="!isVisible(photo)"
              class="ml-2 align-middle text-[10px] uppercase tracking-widest text-text-muted"
            >
              hidden
            </span>
          </p>
          <p class="eyebrow truncate">
            {{ photo.kind === 'video' ? 'Video' : 'Photo' }} ·
            {{ photo.tags.join(', ') || 'uncategorised' }}
          </p>
        </div>

        <div v-if="confirming === photo.publicId" class="flex shrink-0 items-center gap-3">
          <button
            type="button"
            :disabled="busy"
            class="eyebrow border border-accent px-3 py-2 !text-accent transition-colors duration-fast hover:bg-accent hover:!text-text-inverse disabled:opacity-40"
            @click="confirmDelete(photo.publicId, photo.kind)"
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
