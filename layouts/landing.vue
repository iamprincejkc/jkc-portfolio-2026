<script setup lang="ts">
/**
 * Chrome for the business landing page at `/`.
 *
 * The portfolio (now at /me) is dark-only and built for scroll theatre. This
 * page is for a clinic or salon owner opening a link from an email on their
 * phone, so it is light or dark to match their phone, scrolls natively, and
 * keeps one action in reach: get in touch.
 *
 * The colour tokens hang off a class on <html> rather than :root alone, so
 * they apply only while this layout is mounted and the portfolio's own
 * near-black background never bleeds through an overscroll here.
 *
 * Theme: the phone's setting, until the visitor picks one with the switch in
 * the header (components/landing/ThemeToggle.vue). The pick is stored, and
 * the inline script below applies it before first paint, so a returning
 * visitor never sees the other theme flash first.
 */
import { THEME_BOOT_SCRIPT, THEME_COLORS } from '~/utils/landing/theme'

useHead({
  htmlAttrs: { class: 'lp-root' },
  meta: [
    { key: 'theme-color', name: 'theme-color', content: THEME_COLORS.light, media: '(prefers-color-scheme: light)' },
    { key: 'theme-color-dark', name: 'theme-color', content: THEME_COLORS.dark, media: '(prefers-color-scheme: dark)' },
  ],
  script: [{ key: 'lp-theme-boot', innerHTML: THEME_BOOT_SCRIPT, tagPosition: 'head', tagPriority: 'critical' }],
})
</script>

<template>
  <div class="lp">
    <a href="#main" class="lp-skip">Skip to content</a>
    <LandingHeader />
    <slot />
    <LandingFooter />
    <LandingBackToTop />
  </div>
</template>

<style>
html.lp-root {
  --lp-bg: #f6f4ef;
  --lp-surface: #ffffff;
  --lp-surface-2: #eeebe3;
  --lp-ink: #17150f;
  --lp-muted: #57534a;
  --lp-faint: #6f6b62;
  --lp-line: rgba(23, 21, 15, 0.12);
  --lp-line-strong: rgba(23, 21, 15, 0.22);
  --lp-accent: #8a5a12;
  --lp-accent-soft: #f2e6c9;
  --lp-btn-bg: #17150f;
  --lp-btn-fg: #f6f4ef;
  --lp-btn-hover: #2e2a21;
  --lp-fb: #0866ff;
  --lp-ok: #1d7a46;
  --lp-err: #b42318;
  --lp-shadow: 0 1px 2px rgba(23, 21, 15, 0.05), 0 8px 24px -12px rgba(23, 21, 15, 0.18);
  --lp-band: #eeebe3;
  --lp-radius: 16px;
  --lp-header-h: 64px;

  color-scheme: light;
  scroll-padding-top: calc(var(--lp-header-h) + 16px);
}

/*
 * Dark: written twice, once for the phone's setting (unless the visitor
 * picked light) and once for an explicit pick of dark. Keep the two blocks
 * identical.
 */
@media (prefers-color-scheme: dark) {
  html.lp-root:not([data-theme='light']) {
    --lp-bg: #0d0c0a;
    --lp-surface: #161511;
    --lp-surface-2: #1e1c17;
    --lp-ink: #f3efe6;
    --lp-muted: #b3ada1;
    --lp-faint: #8f897d;
    --lp-line: rgba(243, 239, 230, 0.1);
    --lp-line-strong: rgba(243, 239, 230, 0.2);
    --lp-accent: #e8d4a0;
    --lp-accent-soft: rgba(232, 212, 160, 0.1);
    --lp-btn-bg: #e8d4a0;
    --lp-btn-fg: #14120d;
    --lp-btn-hover: #f1e2bb;
    --lp-fb: #4c8dff;
    --lp-ok: #5fd08f;
    --lp-err: #ff8a7a;
    --lp-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 32px -16px rgba(0, 0, 0, 0.7);
    --lp-band: #161511;

    color-scheme: dark;
  }
}
html.lp-root[data-theme='dark'] {
  --lp-bg: #0d0c0a;
  --lp-surface: #161511;
  --lp-surface-2: #1e1c17;
  --lp-ink: #f3efe6;
  --lp-muted: #b3ada1;
  --lp-faint: #8f897d;
  --lp-line: rgba(243, 239, 230, 0.1);
  --lp-line-strong: rgba(243, 239, 230, 0.2);
  --lp-accent: #e8d4a0;
  --lp-accent-soft: rgba(232, 212, 160, 0.1);
  --lp-btn-bg: #e8d4a0;
  --lp-btn-fg: #14120d;
  --lp-btn-hover: #f1e2bb;
  --lp-fb: #4c8dff;
  --lp-ok: #5fd08f;
  --lp-err: #ff8a7a;
  --lp-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 32px -16px rgba(0, 0, 0, 0.7);
  --lp-band: #161511;

  color-scheme: dark;
}

html.lp-root,
html.lp-root body {
  background: var(--lp-bg);
  color: var(--lp-ink);
  font-weight: 400;
}

html.lp-root ::selection {
  background: var(--lp-accent);
  color: var(--lp-bg);
}

.lp {
  min-height: 100vh;
  background: var(--lp-bg);
  color: var(--lp-ink);
  font-family: 'General Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 17px;
  line-height: 1.6;
  font-weight: 400;
}

.lp-wrap {
  width: 100%;
  max-width: 1160px;
  margin-inline: auto;
  padding-inline: 20px;
}
@media (min-width: 768px) {
  .lp-wrap {
    padding-inline: 32px;
  }
}

.lp-section {
  padding-block: 72px;
}
@media (min-width: 768px) {
  .lp-section {
    padding-block: 112px;
  }
}

.lp-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lp-accent);
}

.lp-h2 {
  font-size: clamp(30px, 4.4vw, 46px);
  line-height: 1.1;
  letter-spacing: -0.025em;
  font-weight: 600;
  text-wrap: balance;
  margin-top: 14px;
}
.lp-serif {
  font-family: 'Melodrama', Georgia, serif;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.lp-lead {
  margin-top: 16px;
  max-width: 62ch;
  font-size: 18px;
  line-height: 1.65;
  color: var(--lp-muted);
  text-wrap: pretty;
}

.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 22px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}
.lp-btn:active {
  transform: translateY(1px);
}
.lp-btn--primary {
  background: var(--lp-btn-bg);
  color: var(--lp-btn-fg);
}
.lp-btn--primary:hover {
  background: var(--lp-btn-hover);
}
.lp-btn--ghost {
  border: 1px solid var(--lp-line-strong);
  color: var(--lp-ink);
}
.lp-btn--ghost:hover {
  border-color: var(--lp-ink);
}
.lp-btn--sm {
  min-height: 40px;
  padding: 0 16px;
  font-size: 15px;
}

.lp a:focus-visible,
.lp button:focus-visible,
.lp summary:focus-visible,
.lp input:focus-visible,
.lp textarea:focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 3px;
}

.lp-skip {
  position: absolute;
  left: 12px;
  top: -60px;
  z-index: 100;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--lp-btn-bg);
  color: var(--lp-btn-fg);
  font-weight: 600;
}
.lp-skip:focus {
  top: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .lp *,
  .lp *::before,
  .lp *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
