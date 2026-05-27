<script setup lang="ts">
import { ref } from 'vue'

const form = ref({ name: '', email: '', message: '' })
const status = ref<'' | 'sending' | 'sent' | 'error'>('')

async function submit(e: Event) {
  e.preventDefault()
  status.value = 'sending'
  // TODO: wire to your backend / Formspree / Supabase / EmailJS.
  // Stub: pretend success after a tick.
  await new Promise((r) => setTimeout(r, 600))
  status.value = 'sent'
  form.value = { name: '', email: '', message: '' }
}
</script>

<template>
  <section id="contact" class="py-32 md:py-48 border-t border-border-muted">
    <div class="container-edge">
      <p class="eyebrow mb-6">Get in touch</p>
      <h2 class="font-display headline-lg max-w-4xl">
        Have a project in mind?<br />
        <a
          href="mailto:princejankevin+profile@gmail.com"
          class="italic text-accent underline decoration-1 underline-offset-[0.15em] hover:opacity-70 transition-opacity duration-fast"
        >
          Let&apos;s talk →
        </a>
      </h2>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 mt-16">
        <!-- Left: contact details -->
        <div class="lg:col-span-5 space-y-8">
          <div>
            <p class="eyebrow mb-2">Email</p>
            <a
              href="mailto:princejankevin+profile@gmail.com"
              class="text-lg hover:text-accent transition-colors"
            >
              princejankevin@gmail.com
            </a>
          </div>
          <div>
            <p class="eyebrow mb-2">Based in</p>
            <p class="text-lg">Cebu City, Philippines</p>
            <p class="text-sm text-text-muted mt-1">UTC+8 · Open to remote</p>
          </div>
          <div>
            <p class="eyebrow mb-2">Elsewhere</p>
            <div class="flex flex-wrap gap-x-6 gap-y-2 text-lg">
              <a href="https://ph.linkedin.com/in/iamprincejkc" target="_blank" rel="noopener" class="hover:text-accent transition-colors">LinkedIn ↗</a>
              <a href="https://github.com/iamprincejkc" target="_blank" rel="noopener" class="hover:text-accent transition-colors">GitHub ↗</a>
              <a href="https://dev.to/iamprincejkc" target="_blank" rel="noopener" class="hover:text-accent transition-colors">Dev.to ↗</a>
            </div>
          </div>
        </div>

        <!-- Right: form -->
        <form
          class="lg:col-span-7 space-y-6"
          @submit="submit"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label class="block">
              <span class="eyebrow block mb-2">Your name</span>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full bg-transparent border-b border-border-muted py-3 focus:border-accent focus:outline-none transition-colors"
              />
            </label>
            <label class="block">
              <span class="eyebrow block mb-2">Email</span>
              <input
                v-model="form.email"
                type="email"
                required
                class="w-full bg-transparent border-b border-border-muted py-3 focus:border-accent focus:outline-none transition-colors"
              />
            </label>
          </div>

          <label class="block">
            <span class="eyebrow block mb-2">Tell me about it</span>
            <textarea
              v-model="form.message"
              rows="5"
              required
              class="w-full bg-transparent border-b border-border-muted py-3 focus:border-accent focus:outline-none transition-colors resize-none"
            ></textarea>
          </label>

          <button
            type="submit"
            :disabled="status === 'sending'"
            class="inline-flex items-center gap-3 mt-4 px-8 py-4 bg-primary text-text-inverse rounded-full font-medium hover:bg-accent transition-colors duration-normal disabled:opacity-50"
          >
            <span v-if="status === 'sending'">Sending…</span>
            <span v-else-if="status === 'sent'">Sent ✓</span>
            <span v-else>Send message</span>
            <span aria-hidden>→</span>
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
