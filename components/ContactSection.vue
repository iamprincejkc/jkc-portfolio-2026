<script setup lang="ts">
import { ref } from 'vue'

const form = ref({ name: '', email: '', message: '' })
const status = ref<'' | 'sending' | 'sent' | 'error'>('')
const error = ref('')

// Spam trap. A human never sees this field, so anything that fills it is a bot.
const botField = ref('')

/**
 * Posts to our own /api/contact.
 *
 * That endpoint sends the email through Resend and archives the submission to
 * Netlify Forms afterwards. It previously posted to Netlify Forms directly and
 * relied on a Netlify outgoing webhook to trigger the email - but that webhook
 * never fired, and its delivery log is not inspectable from outside. Going
 * direct removes the unreliable hop and makes the whole path testable.
 */
async function submit(e: Event) {
  e.preventDefault()
  if (status.value === 'sending') return

  status.value = 'sending'
  error.value = ''

  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: {
        name: form.value.name,
        email: form.value.email,
        message: form.value.message,
        'bot-field': botField.value,
      },
    })

    status.value = 'sent'
    form.value = { name: '', email: '', message: '' }
  } catch (caught: any) {
    // Never claim success on failure - the whole point of this section is that
    // a message actually arrives. Surface the server's own reason when it gave
    // one, since "fill in every field" is more useful than "could not send".
    status.value = 'error'
    error.value =
      caught?.data?.statusMessage ||
      caught?.statusMessage ||
      'Could not send. Please email me directly instead.'
  }
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
              class="tap-safe text-lg hover:text-accent transition-colors"
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
              <a href="https://ph.linkedin.com/in/iamprincejkc" target="_blank" rel="noopener noreferrer" class="tap-safe hover:text-accent transition-colors">LinkedIn ↗</a>
              <a href="https://github.com/iamprincejkc" target="_blank" rel="noopener noreferrer" class="tap-safe hover:text-accent transition-colors">GitHub ↗</a>
              <a href="https://dev.to/iamprincejkc" target="_blank" rel="noopener noreferrer" class="tap-safe hover:text-accent transition-colors">Dev.to ↗</a>
            </div>
          </div>
        </div>

        <!-- Right: form -->
        <form
          class="lg:col-span-7 space-y-6"
          name="contact"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          @submit="submit"
        >
          <input type="hidden" name="form-name" value="contact" />

          <!-- Honeypot: hidden from people, irresistible to bots. -->
          <p class="hidden" aria-hidden="true">
            <label>Leave this empty <input v-model="botField" name="bot-field" tabindex="-1" autocomplete="off" /></label>
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label class="block">
              <span class="eyebrow block mb-2">Your name</span>
              <input
                v-model="form.name"
                name="name"
                type="text"
                autocomplete="name"
                required
                class="w-full bg-transparent border-b border-border-muted py-3 focus:border-accent focus:outline-none transition-colors"
              />
            </label>
            <label class="block">
              <span class="eyebrow block mb-2">Email</span>
              <input
                v-model="form.email"
                name="email"
                type="email"
                autocomplete="email"
                required
                class="w-full bg-transparent border-b border-border-muted py-3 focus:border-accent focus:outline-none transition-colors"
              />
            </label>
          </div>

          <label class="block">
            <span class="eyebrow block mb-2">Tell me about it</span>
            <textarea
              v-model="form.message"
              name="message"
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
            <span v-else-if="status === 'error'">Try again</span>
            <span v-else>Send message</span>
            <span aria-hidden>→</span>
          </button>

          <p aria-live="polite" class="min-h-6 text-sm">
            <span v-if="status === 'sent'" class="text-accent">
              Thanks — I’ll get back to you.
            </span>
            <span v-else-if="status === 'error'" class="text-text-muted">{{ error }}</span>
          </p>
        </form>
      </div>
    </div>
  </section>
</template>
