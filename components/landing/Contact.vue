<script setup lang="ts">
import { computed, ref } from 'vue'
import { BASE, CONTACT } from '~/utils/landing/content'
import { trackLanding } from '~/composables/useLandingAnalytics'

/**
 * The enquiry form for business owners.
 *
 * Posts to /api/contact like the portfolio form does, with two more fields:
 * the business name, and a phone number that can stand in for the email,
 * because plenty of owners would rather be called or texted back.
 *
 * Every field name must also exist in public/forms.html, which is how Netlify
 * Forms learns the form's shape for the archive copy.
 */
const empty = () => ({ name: '', business: '', email: '', phone: '', message: '' })
const form = ref(empty())
const botField = ref('')
const status = ref<'' | 'sending' | 'sent' | 'error'>('')
const error = ref('')

const needsReplyChannel = computed(() => !form.value.email.trim() && !form.value.phone.trim())

async function submit() {
  if (status.value === 'sending') return
  if (needsReplyChannel.value) {
    status.value = 'error'
    error.value = 'Please leave an email or a phone number so I can reply.'
    return
  }

  status.value = 'sending'
  error.value = ''
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: { ...form.value, 'bot-field': botField.value },
    })
    status.value = 'sent'
    trackLanding({
      event: 'generate_lead',
      method: 'contact_form',
      has_email: !!form.value.email.trim(),
      has_phone: !!form.value.phone.trim(),
    })
    form.value = empty()
  } catch (caught: any) {
    // Never claim success on a failure: the server's own reason is more
    // useful than a generic one, and the email link is always there.
    status.value = 'error'
    error.value =
      caught?.data?.statusMessage || caught?.statusMessage || `Could not send. Please email me at ${CONTACT.email}.`
  }
}

const whatsapp = CONTACT.phoneIntl ? `https://wa.me/${CONTACT.phoneIntl}` : ''
const tel = CONTACT.phoneIntl ? `tel:+${CONTACT.phoneIntl}` : ''
const messenger = CONTACT.messenger ? `https://m.me/${CONTACT.messenger}` : ''
</script>

<template>
  <section id="contact" class="lp-section lp-contact" aria-labelledby="contact-title">
    <div class="lp-wrap lp-contact__grid">
      <div class="lp-contact__intro">
        <p class="lp-eyebrow">Get in touch</p>
        <h2 id="contact-title" class="lp-h2">Tell me about your <span class="lp-serif">business.</span></h2>
        <p class="lp-lead">
          A few lines is enough: what you do, where you are, and what you have online today. I reply personally within a day or
          two, with ideas and a free first draft. No obligation.
        </p>

        <ul class="lp-contact__channels">
          <li>
            <a :href="CONTACT.emailHref" class="lp-channel" @click="trackLanding({ event: 'contact_click', method: 'email' })">
              <span class="lp-channel__icon"><LandingIcon name="mail" /></span>
              <span>
                <small>Email</small>
                {{ CONTACT.email }}
              </span>
            </a>
          </li>
          <li v-if="messenger">
            <a :href="messenger" target="_blank" rel="noopener noreferrer" class="lp-channel" @click="trackLanding({ event: 'contact_click', method: 'messenger' })">
              <span class="lp-channel__icon lp-channel__icon--fb"><LandingIcon name="messenger" /></span>
              <span>
                <small>Messenger</small>
                Send me a message
              </span>
            </a>
          </li>
          <li v-if="tel">
            <a :href="tel" class="lp-channel" @click="trackLanding({ event: 'contact_click', method: 'phone' })">
              <span class="lp-channel__icon"><LandingIcon name="phone" /></span>
              <span>
                <small>Call or text</small>
                {{ CONTACT.phone }}
              </span>
            </a>
          </li>
          <li v-if="whatsapp">
            <a :href="whatsapp" target="_blank" rel="noopener noreferrer" class="lp-channel" @click="trackLanding({ event: 'contact_click', method: 'whatsapp' })">
              <span class="lp-channel__icon"><LandingIcon name="whatsapp" /></span>
              <span>
                <small>WhatsApp</small>
                {{ CONTACT.phone }}
              </span>
            </a>
          </li>
          <li>
            <div class="lp-channel">
              <span class="lp-channel__icon"><LandingIcon name="pin" /></span>
              <span>
                <small>Based in {{ BASE.city }}, {{ BASE.country }}</small>
                Working with clients anywhere
              </span>
            </div>
          </li>
        </ul>
      </div>

      <form class="lp-form" novalidate @submit.prevent="submit">
        <!-- Spam trap: hidden from people, filled in by bots. -->
        <p class="lp-form__trap" aria-hidden="true">
          <label>Leave this empty <input v-model="botField" name="bot-field" tabindex="-1" autocomplete="off" /></label>
        </p>

        <div class="lp-form__row">
          <label class="lp-field">
            <span>Your name</span>
            <input v-model="form.name" name="name" required autocomplete="name" maxlength="200" />
          </label>
          <label class="lp-field">
            <span>Business name <em>optional</em></span>
            <input v-model="form.business" name="business" autocomplete="organization" maxlength="200" />
          </label>
        </div>

        <div class="lp-form__row">
          <label class="lp-field">
            <span>Email</span>
            <input v-model="form.email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="320" />
          </label>
          <label class="lp-field">
            <span>Phone or Viber</span>
            <input v-model="form.phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="40" placeholder="0917 123 4567" />
          </label>
        </div>
        <p class="lp-form__hint">Leave an email, a phone number, or both.</p>

        <label class="lp-field">
          <span>What do you need?</span>
          <textarea
            v-model="form.message"
            name="message"
            required
            rows="5"
            maxlength="5000"
            placeholder="e.g. I run a small salon with only a Facebook page. I'd like a simple website where customers can see our services and message us on Messenger."
          />
        </label>

        <div class="lp-form__foot">
          <button type="submit" class="lp-btn lp-btn--primary" :disabled="status === 'sending'">
            {{ status === 'sending' ? 'Sending...' : 'Send message' }}
            <LandingIcon v-if="status !== 'sending'" name="arrow-right" :size="18" />
          </button>
          <p v-if="status === 'sent'" class="lp-form__ok" role="status">
            <LandingIcon name="check" :size="18" />
            Thanks, it's on its way. I'll get back to you soon.
          </p>
          <p v-else-if="status === 'error'" class="lp-form__err" role="alert">{{ error }}</p>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.lp-contact {
  border-top: 1px solid var(--lp-line);
}
.lp-contact__grid {
  display: grid;
  gap: 48px;
}
@media (min-width: 960px) {
  .lp-contact__grid {
    grid-template-columns: 5fr 6fr;
    gap: 72px;
    align-items: start;
  }
}

.lp-contact__channels {
  margin-top: 32px;
  display: grid;
  gap: 4px;
}
.lp-channel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
  min-height: 56px;
  overflow-wrap: anywhere;
}
a.lp-channel:hover {
  color: var(--lp-accent);
}
.lp-channel small {
  display: block;
  font-size: 13px;
  color: var(--lp-faint);
}
.lp-channel__icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--lp-surface-2);
  color: var(--lp-ink);
}
.lp-channel__icon--fb {
  color: var(--lp-fb);
}

.lp-form {
  position: relative;
  display: grid;
  gap: 18px;
  padding: 24px;
  border-radius: var(--lp-radius);
  background: var(--lp-surface);
  border: 1px solid var(--lp-line);
  box-shadow: var(--lp-shadow);
}
@media (min-width: 768px) {
  .lp-form {
    padding: 36px;
  }
}
.lp-form__row {
  display: grid;
  gap: 18px;
}
@media (min-width: 600px) {
  .lp-form__row {
    grid-template-columns: 1fr 1fr;
  }
}

.lp-field {
  display: grid;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
}
.lp-field em {
  font-style: normal;
  font-weight: 400;
  color: var(--lp-faint);
}
.lp-field input,
.lp-field textarea {
  width: 100%;
  min-height: 48px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--lp-line-strong);
  background: var(--lp-bg);
  color: var(--lp-ink);
  font: inherit;
  font-weight: 400;
  font-size: 16px; /* 16px keeps iOS from zooming in on focus. */
  transition: border-color 0.2s ease;
}
.lp-field textarea {
  resize: vertical;
  line-height: 1.5;
}
.lp-field input::placeholder,
.lp-field textarea::placeholder {
  color: var(--lp-faint);
  opacity: 0.8;
}
.lp-field input:hover,
.lp-field textarea:hover {
  border-color: var(--lp-faint);
}
.lp-field input:focus-visible,
.lp-field textarea:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 0;
  border-color: transparent;
}

.lp-form__hint {
  margin-top: -8px;
  font-size: 14px;
  color: var(--lp-faint);
}

.lp-form__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}
.lp-form__foot .lp-btn[disabled] {
  opacity: 0.7;
  cursor: progress;
}
.lp-form__ok,
.lp-form__err {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
}
.lp-form__ok {
  color: var(--lp-ok);
}
.lp-form__err {
  color: var(--lp-err);
}

.lp-form__trap {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
