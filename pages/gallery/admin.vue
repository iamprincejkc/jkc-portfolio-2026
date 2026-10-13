<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ layout: 'gallery' })

useHead({
  title: 'Upload — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { data, refresh } = useGalleryPhotos()
const { data: vault, refresh: refreshVault } = useGalleryVault()

const photos = computed(() => data.value?.photos ?? [])
const hiddenCount = computed(() => photos.value.filter((photo) => !isVisible(photo)).length)

const vaultReady = computed(() => vault.value?.configured === true)
const vaultItems = computed(() => vault.value?.items ?? [])

/*
 * Upload and manage were stacked, so reaching the library meant scrolling past
 * the whole upload queue. They are separate tasks; they are now separate tabs.
 */
const tab = ref<'upload' | 'manage'>('upload')

function afterUpload() {
  refresh()
  refreshVault()
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
            <sup class="ml-1 tabular-nums opacity-60">{{ photos.length + vaultItems.length }}</sup>
          </button>
        </div>

        <p class="eyebrow text-text-muted">
          <template v-if="hiddenCount">{{ hiddenCount }} hidden from the gallery</template>
        </p>
      </div>
    </div>

    <div v-show="tab === 'upload'" class="pt-6">
      <GalleryUploader :vault-ready="vaultReady" @uploaded="afterUpload" />
    </div>

    <div v-show="tab === 'manage'" class="pt-6">
      <!-- Private originals on R2, listed first: they are only reachable here. -->
      <section v-if="vaultReady" class="mb-12">
        <p class="eyebrow">
          Private videos · originals
          <sup class="ml-1 tabular-nums opacity-60">{{ vaultItems.length }}</sup>
        </p>
        <GalleryVault :items="vaultItems" @deleted="refreshVault()" />
      </section>

      <p v-if="vaultReady" class="eyebrow">
        Gallery
        <sup class="ml-1 tabular-nums opacity-60">{{ photos.length }}</sup>
      </p>
      <GalleryManager :photos="photos" @deleted="refresh()" />
    </div>
  </div>
</template>
