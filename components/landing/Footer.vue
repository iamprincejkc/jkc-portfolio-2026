<script setup lang="ts">
import { BASE, CONTACT } from '~/utils/landing/content'
import { trackLanding } from '~/composables/useLandingAnalytics'
</script>

<template>
  <footer class="lp-footer">
    <div class="lp-wrap lp-footer__grid">
      <div>
        <p class="lp-footer__name">Jan Kevin</p>
        <p class="lp-footer__muted">Senior Software Engineer, based in {{ BASE.city }}, {{ BASE.country }}</p>
        <p class="lp-footer__muted lp-footer__areas">Websites and business systems for small businesses, wherever they are.</p>
      </div>

      <nav class="lp-footer__links" aria-label="More">
        <a href="/me/">About me</a>
        <a :href="CONTACT.linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a :href="CONTACT.github" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="/qr-generator/">Free QR code maker</a>
        <a :href="CONTACT.emailHref" @click="trackLanding({ event: 'contact_click', method: 'email' })">{{ CONTACT.email }}</a>
      </nav>
    </div>
    <div class="lp-wrap">
      <p class="lp-footer__fine">&copy; 2026 Jan Kevin. This page counts visits with Google Analytics. No ads, and no advertising cookies.</p>
    </div>
  </footer>
</template>

<style scoped>
.lp-footer {
  border-top: 1px solid var(--lp-line);
  padding-block: 48px 32px;
  font-size: 15px;
}
.lp-footer__grid {
  display: grid;
  gap: 32px;
}
@media (min-width: 768px) {
  .lp-footer__grid {
    grid-template-columns: 1fr auto;
    align-items: start;
  }
}
.lp-footer__name {
  font-weight: 600;
}
.lp-footer__muted {
  color: var(--lp-muted);
}
.lp-footer__areas {
  margin-top: 8px;
  max-width: 46ch;
}
.lp-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  color: var(--lp-muted);
}
@media (min-width: 768px) {
  .lp-footer__links {
    flex-direction: column;
    align-items: flex-end;
  }
}
.lp-footer__links a {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  transition: color 0.2s ease;
}
.lp-footer__links a:hover {
  color: var(--lp-ink);
}
.lp-footer__fine {
  margin-top: 32px;
  font-size: 13px;
  color: var(--lp-faint);
}
</style>
