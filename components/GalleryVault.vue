<script setup lang="ts">
import { ref } from 'vue'
import type { SignedVaultItem } from '../composables/useGallery'

/**
 * The private video vault: play, download the original, or delete.
 *
 * Same row shape and two-step delete as the gallery manager, so the Library
 * tab reads as one list in two sections.
 */
defineProps<{ items: SignedVaultItem[] }>()
const emit = defineEmits<{ deleted: [] }>()

const playing = ref<string | null>(null)
const confirming = ref<string | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
/** Posters that failed to load - the capture can succeed and the upload still miss. */
const brokenPosters = ref(new Set<string>())

async function confirmDelete(key: string) {
  busy.value = true
  error.value = null
  try {
    await $fetch('/api/gallery/admin/vault/delete', { method: 'POST', body: { key } })
    confirming.value = null
    if (playing.value === key) playing.value = null
    emit('deleted')
  } catch (caught: any) {
    error.value = caught?.data?.statusMessage || 'Delete failed.'
  } finally {
    busy.value = false
  }
}

function details(item: SignedVaultItem): string {
  return [
    formatBytes(item.size),
    formatDuration(item.duration),
    item.width && item.height ? `${item.width}×${item.height}` : '',
    item.tags.join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <div>
    <div class="min-h-6" aria-live="polite">
      <p v-if="error" class="text-xs text-text-muted">{{ error }}</p>
    </div>

    <p v-if="items.length === 0" class="eyebrow border-t border-border-muted py-10">
      No videos stored yet.
    </p>

    <ul v-else class="border-t border-border-muted">
      <li v-for="item in items" :key="item.key" class="border-b border-border-muted py-4">
        <!-- Actions wrap under the title on a phone, where three of them beside
             it would leave the title a few letters wide. -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="button"
            class="relative h-14 w-20 shrink-0 overflow-hidden bg-white/5"
            :aria-label="`Play ${item.title}`"
            @click="playing = playing === item.key ? null : item.key"
          >
            <img
              v-if="item.posterUrl && !brokenPosters.has(item.key)"
              :src="item.posterUrl"
              alt=""
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover"
              @error="brokenPosters.add(item.key)"
            />
            <span v-else class="eyebrow flex h-full w-full items-center justify-center !text-accent">
              {{ item.filename.split('.').pop() }}
            </span>
          </button>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">
              {{ item.title }}
              <span v-if="item.client" class="text-text-muted"> · {{ item.client }}</span>
            </p>
            <p class="eyebrow truncate">{{ details(item) }}</p>
          </div>

          <div
            v-if="confirming === item.key"
            class="flex w-full shrink-0 items-center gap-3 pl-24 sm:w-auto sm:pl-0"
          >
            <button
              type="button"
              :disabled="busy"
              class="eyebrow border border-accent px-3 py-2 !text-accent transition-colors duration-fast hover:bg-accent hover:!text-text-inverse disabled:opacity-40"
              @click="confirmDelete(item.key)"
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
          <div v-else class="flex w-full shrink-0 items-center gap-5 pl-24 sm:w-auto sm:pl-0">
            <button
              type="button"
              class="eyebrow hover:text-primary transition-colors duration-fast"
              :aria-expanded="playing === item.key"
              @click="playing = playing === item.key ? null : item.key"
            >
              {{ playing === item.key ? 'Close' : 'Play' }}
            </button>
            <a
              :href="item.downloadUrl"
              class="eyebrow hover:text-primary transition-colors duration-fast"
              rel="noopener"
            >
              Download
            </a>
            <button
              type="button"
              class="eyebrow hover:text-primary transition-colors duration-fast"
              @click="
                confirming = item.key;
                error = null
              "
            >
              Delete
            </button>
          </div>
        </div>

        <!-- The original file, played as stored. iPhone HEVC plays in Safari;
             a browser without HEVC support can still download it. -->
        <video
          v-if="playing === item.key"
          :src="item.playUrl"
          :poster="item.posterUrl || undefined"
          controls
          playsinline
          preload="metadata"
          class="mt-4 max-h-[70vh] w-full bg-black object-contain"
          :aria-label="item.title"
        />
      </li>
    </ul>
  </div>
</template>
