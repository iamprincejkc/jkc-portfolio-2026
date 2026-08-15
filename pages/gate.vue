<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

definePageMeta({ layout: 'blank' })

const route = useRoute()

const scope = computed(() => (route.query.scope === 'admin' ? 'admin' : 'site'))

/** Only ever redirect to a path on this origin. */
const redirectTo = computed(() => {
  const next = route.query.next
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return '/gallery'
  }
  return next
})

useHead({
  title: 'Locked — JKC',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

const input = ref<HTMLInputElement | null>(null)
const pin = ref('')
const reveal = ref(false)
const error = ref<string | null>(null)
const status = ref<'idle' | 'checking' | 'done'>('idle')

onMounted(() => input.value?.focus())

async function submit() {
  if (!pin.value || status.value !== 'idle') return

  status.value = 'checking'
  error.value = null

  try {
    await $fetch('/api/gallery/session', {
      method: 'POST',
      body: { pin: pin.value, scope: scope.value },
    })
    status.value = 'done'
    // A full navigation, so the server re-reads the new cookie.
    window.location.assign(redirectTo.value)
  } catch (caught: any) {
    error.value = caught?.data?.statusMessage || caught?.statusMessage || 'Something went wrong.'
    status.value = 'idle'
    pin.value = ''
    await nextTick()
    input.value?.focus()
  }
}
</script>

<template>
  <main class="grid min-h-dvh grid-rows-[auto_1fr_auto] container-edge">
    <header class="flex items-center justify-between py-6">
      <p class="text-sm font-medium tracking-tight">JKC</p>
      <p class="eyebrow">{{ scope === 'admin' ? 'Admin' : 'Private' }}</p>
    </header>

    <div class="flex items-center justify-center py-12">
      <div class="w-full max-w-md">
        <h1 class="font-display headline-lg">
          <template v-if="scope === 'admin'">Admin<br />access.</template>
          <template v-else>This gallery<br />is private.</template>
        </h1>

        <p class="mt-6 max-w-sm text-text-muted text-sm">
          {{
            scope === 'admin'
              ? 'Uploading needs the admin PIN. It is separate from the viewing PIN.'
              : 'Enter the PIN you were given to view the work.'
          }}
        </p>

        <form class="mt-12" @submit.prevent="submit">
          <label for="pin" class="eyebrow">
            {{ scope === 'admin' ? 'Admin PIN' : 'Access PIN' }}
          </label>

          <div
            class="mt-4 flex items-center gap-4 border-b border-border-muted pb-3 transition-colors duration-fast focus-within:border-accent"
          >
            <input
              id="pin"
              ref="input"
              v-model="pin"
              :type="reveal ? 'text' : 'password'"
              inputmode="numeric"
              autocomplete="one-time-code"
              autocorrect="off"
              spellcheck="false"
              placeholder="••••••"
              :disabled="status !== 'idle'"
              :aria-invalid="error ? 'true' : undefined"
              :aria-describedby="error ? 'pin-error' : undefined"
              class="w-full bg-transparent text-2xl tabular-nums tracking-[0.35em] outline-none placeholder:text-text-muted/40 disabled:opacity-50"
              @input="error = null"
            />
            <button
              type="button"
              class="eyebrow shrink-0 hover:text-primary transition-colors duration-fast"
              @click="reveal = !reveal"
            >
              {{ reveal ? 'Hide' : 'Show' }}
            </button>
          </div>

          <!-- Reserved height so the button never jumps when an error appears. -->
          <div class="min-h-6 pt-3" aria-live="polite">
            <p v-if="error" id="pin-error" class="text-sm text-text-muted">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="status !== 'idle' || !pin"
            class="eyebrow mt-6 w-full border border-accent bg-accent px-6 py-4 !text-text-inverse transition-all duration-normal ease-out-expo hover:bg-transparent hover:!text-accent disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-transparent disabled:!text-text-muted"
          >
            {{ status === 'checking' ? 'Checking' : status === 'done' ? 'Welcome' : 'Enter' }}
          </button>
        </form>
      </div>
    </div>

    <footer class="py-6">
      <p class="eyebrow">© {{ new Date().getFullYear() }}</p>
    </footer>
  </main>
</template>
