<script setup lang="ts">
const { data } = useGallerySession()

async function lock() {
  await $fetch('/api/gallery/session', { method: 'DELETE' })
  await navigateTo('/gate')
}
</script>

<template>
  <div>
    <a href="#gallery-main" class="skip-link">Skip to content</a>

    <header class="gallery-header">
      <NuxtLink to="/gallery" class="text-sm font-medium tracking-tight">
        Gallery
        <span class="text-text-muted ml-2 hidden sm:inline">JKC</span>
      </NuxtLink>

      <nav class="flex items-center gap-6">
        <NuxtLink
          v-if="data?.scope === 'admin'"
          to="/gallery/admin"
          class="eyebrow hover:text-primary transition-colors duration-fast"
        >
          Upload
        </NuxtLink>
        <NuxtLink to="/" class="eyebrow hover:text-primary transition-colors duration-fast">
          Portfolio
        </NuxtLink>
        <button
          type="button"
          class="eyebrow hover:text-primary transition-colors duration-fast"
          @click="lock"
        >
          Lock
        </button>
      </nav>
    </header>

    <main id="gallery-main" class="pt-[var(--gallery-header-h)]">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.gallery-header {
  position: fixed;
  inset-inline: 0;
  top: 0;
  z-index: 50;
  height: var(--gallery-header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: color-mix(in oklab, var(--color-bg) 82%, transparent);
  backdrop-filter: blur(20px) saturate(1.4);
}

@media (min-width: 1024px) {
  .gallery-header {
    padding-inline: 3rem;
  }
}

.skip-link {
  position: absolute;
  left: -9999px;
}

.skip-link:focus {
  left: 1rem;
  top: 1rem;
  z-index: 60;
  background: var(--color-fg);
  color: var(--color-bg);
  padding: 0.75rem 1rem;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
</style>
