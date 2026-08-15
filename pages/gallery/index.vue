<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ layout: 'gallery' })

useHead({
  title: 'Gallery — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const { data, pending } = useGalleryPhotos()
const { density, setDensity, options: densityOptions } = useGalleryDensity()

const ALL = 'all'
const active = ref(ALL)

/*
 * Video is stored but not displayed - see VISIBLE_KINDS. Categories are
 * recounted from the filtered set rather than reusing the server's counts,
 * which cover everything: a "landscape 6" chip that reveals four photos
 * would just look broken.
 */
const photos = computed(() => (data.value?.photos ?? []).filter(isVisible))
const categories = computed(() => categoriesFrom(photos.value))

const visible = computed(() =>
  active.value === ALL
    ? photos.value
    : photos.value.filter((photo) => photo.tags.includes(active.value)),
)
</script>

<template>
  <GallerySetupNotice v-if="data && !data.configured && !pending" />

  <div v-else>
    <section class="container-edge pt-[clamp(3rem,9vw,7rem)] pb-[clamp(2rem,5vw,4rem)]">
      <p class="eyebrow">Gallery</p>
      <h1 class="font-display headline-xl mt-5">Frames,<br />off the clock.</h1>

      <dl class="mt-[clamp(3rem,7vw,6rem)] grid gap-y-6 border-t border-border-muted pt-6 sm:grid-cols-3 sm:gap-x-8">
        <div class="flex items-baseline justify-between gap-4 sm:block">
          <dt class="eyebrow">Frames</dt>
          <dd class="text-lg tabular-nums sm:mt-2">
            {{ String(photos.length).padStart(2, '0') }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 sm:block">
          <dt class="eyebrow">Categories</dt>
          <dd class="text-lg tabular-nums sm:mt-2">
            {{ String(categories.length).padStart(2, '0') }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-4 sm:block">
          <dt class="eyebrow">Access</dt>
          <dd class="text-lg sm:mt-2">Private</dd>
        </div>
      </dl>
    </section>

    <div class="container-edge pb-[clamp(4rem,10vw,8rem)]">
      <p v-if="pending" class="eyebrow border-t border-border-muted py-24 text-center">
        Loading
      </p>

      <p
        v-else-if="photos.length === 0"
        class="eyebrow border-t border-border-muted py-24 text-center"
      >
        No frames yet.
      </p>

      <template v-else>
        <div
          v-if="categories.length > 1"
          class="sticky top-[var(--gallery-header-h)] z-40 -mx-6 border-b border-border-muted bg-bg/85 px-6 backdrop-blur-xl lg:-mx-12 lg:px-12"
        >
          <div class="flex items-center justify-between gap-6 py-4">
          <div
            class="no-scrollbar flex gap-6 overflow-x-auto"
            role="group"
            aria-label="Filter by category"
          >
            <button
              type="button"
              class="eyebrow shrink-0 whitespace-nowrap transition-colors duration-fast"
              :class="active === ALL ? '!text-accent' : 'hover:!text-primary'"
              :aria-pressed="active === ALL"
              @click="active = ALL"
            >
              All<sup class="ml-1 tabular-nums opacity-60">{{ photos.length }}</sup>
            </button>
            <button
              v-for="category in categories"
              :key="category.name"
              type="button"
              class="eyebrow shrink-0 whitespace-nowrap transition-colors duration-fast"
              :class="active === category.name ? '!text-accent' : 'hover:!text-primary'"
              :aria-pressed="active === category.name"
              @click="active = category.name"
            >
              {{ category.name
              }}<sup class="ml-1 tabular-nums opacity-60">{{ category.count }}</sup>
            </button>
          </div>

          <!-- Density: hidden below 1024px, where the grid has no room to
               offer a choice. -->
          <div
            class="hidden shrink-0 items-center gap-4 lg:flex"
            role="group"
            aria-label="Frames per row"
          >
            <button
              v-for="option in densityOptions"
              :key="option.value"
              type="button"
              class="eyebrow transition-colors duration-fast"
              :class="density === option.value ? '!text-accent' : 'hover:!text-primary'"
              :aria-pressed="density === option.value"
              :title="`${option.perRow} per row`"
              @click="setDensity(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          </div>
        </div>

        <div class="feed pt-[clamp(2.5rem,6vw,5rem)]" :data-density="density">
          <GalleryFrame
            v-for="(photo, index) in visible"
            :key="photo.publicId"
            :photo="photo"
            :index="index"
            :priority="active === ALL && index < 2"
            :density="density"
          />
        </div>

        <p v-if="visible.length === 0" class="eyebrow py-24 text-center">
          Nothing filed under “{{ active }}”.
        </p>
      </template>
    </div>

    <GalleryReveal />
  </div>
</template>
