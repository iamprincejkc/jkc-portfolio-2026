<script setup lang="ts">
/**
 * Shown when Cloudinary credentials are missing, so the route is reviewable
 * before the keys are in place instead of throwing.
 */
const vars: [string, string][] = [
  ['NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'Dashboard → Product Environment Credentials → Cloud name'],
  ['NUXT_CLOUDINARY_API_KEY', 'Dashboard → API Keys → the key named “Gallery”'],
  ['NUXT_CLOUDINARY_API_SECRET', 'Paired with that key. Server only — never expose it.'],
  ['NUXT_CLOUDINARY_FOLDER', 'Optional. Defaults to “gallery”.'],
]
</script>

<template>
  <div class="container-edge max-w-3xl py-[clamp(4rem,12vw,9rem)]">
    <p class="eyebrow">Setup</p>
    <h1 class="font-display headline-lg mt-5">Connect Cloudinary<br />to load the gallery.</h1>
    <p class="mt-8 max-w-prose text-sm text-text-muted">
      The gate, the routes and the upload console are all running. Add these
      environment variables and reload — locally in
      <code class="text-primary">.env</code>, or on Netlify under
      Site&nbsp;settings → Environment&nbsp;variables.
    </p>

    <dl class="mt-10 border-t border-border-muted">
      <div
        v-for="[name, hint] in vars"
        :key="name"
        class="grid gap-1 border-b border-border-muted py-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:gap-6"
      >
        <dt class="break-all font-mono text-xs text-primary">{{ name }}</dt>
        <dd class="text-xs text-text-muted">{{ hint }}</dd>
      </div>
    </dl>
  </div>
</template>
