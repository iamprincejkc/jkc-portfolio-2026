<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ layout: 'gallery' })

useHead({
  title: 'Upload — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { data, refresh } = useGalleryPhotos()

const photos = computed(() => data.value?.photos ?? [])
const hiddenCount = computed(() => photos.value.filter((photo) => !isVisible(photo)).length)

/*
 * Upload and manage were stacked, so reaching the library meant scrolling past
 * the whole upload queue. They are separate tasks; they are now separate tabs.
 */
const tab = ref<'upload' | 'manage'>('upload')

function afterUpload() {
  refresh()
  // Land on the library so the result of the upload is visible.
  tab.value = 'manage'
}
</script>

<template>
  <GallerySetupNotice v-if="data && !data.configured" />

  <div v-else class="container-edge pb-[clamp(3rem,8vw,6rem)]">
    <!-- Compact header: the page is a tool, not a landing page. -->
    <div
      class="sticky top-[var(--gallery-header-h)] z-40 -mx-6 border-b border-border-muted bg-bg/90 px-6 backdrop-blur-xl lg:-mx-12 lg:px-12"
    >
      <div class="flex flex-wrap items-center justify-between gap-4 py-4">
        <div class="flex items-center gap-6">
          <button
            type="button"
            class="eyebrow transition-colors duration-fast"
            :class="tab === 'upload' ? '!text-accent' : 'hover:!text-primary'"
            :aria-pressed="tab === 'upload'"
            @click="tab = 'upload'"
          >
            Upload
          </button>
          <button
            type="button"
            class="eyebrow transition-colors duration-fast"
            :class="tab === 'manage' ? '!text-accent' : 'hover:!text-primary'"
            :aria-pressed="tab === 'manage'"
            @click="tab = 'manage'"
          >
            Library
            <sup class="ml-1 tabular-nums opacity-60">{{ photos.length }}</sup>
          </button>
        </div>

        <p class="eyebrow text-text-muted">
          <template v-if="hiddenCount">{{ hiddenCount }} hidden from the gallery</template>
        </p>
      </div>
    </div>

    <div v-show="tab === 'upload'" class="pt-6">
      <GalleryUploader @uploaded="afterUpload" />
    </div>

    <div v-show="tab === 'manage'" class="pt-6">
      <GalleryManager :photos="photos" @deleted="refresh()" />
    </div>
  </div>
</template>
