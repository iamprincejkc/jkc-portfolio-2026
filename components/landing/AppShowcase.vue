<script setup lang="ts">
import { SHOWCASE_REEL, SHOWCASE_ROWS } from '~/utils/landing/content'

/**
 * "Apps I build for myself": a wall of phone screens from JKC's own apps, and a
 * hand holding one more phone that rides down the wall as the page scrolls.
 *
 * How the effect works, with no scroll script at all:
 *
 *  - The wall is five columns. The middle column is empty in every row.
 *  - Over the wall sits a track as tall as the wall. The hand is the last thing
 *    in that track and is `position: sticky; bottom: 0`, so while the wall
 *    passes it stays pinned to the bottom of the screen, and it can never leave
 *    the track. The wall scrolls up behind it and the phone in the hand always
 *    sits in the empty column, so it reads as one of these phones, picked up.
 *  - The stage's padding is sized from the hand so that the phone's screen
 *    fills the first row's empty slot when the wall arrives, and drops exactly
 *    into the last row's empty slot when the wall leaves (see HAND below).
 *
 * The phone is drawn here, in CSS: a current iPhone Pro in natural titanium,
 * so it stays sharp at any size and never shows a dated model. The hand is a
 * photo with the photo's own phone removed (scripts/build-showcase.mjs): only
 * skin is left, so the fingers and thumb sit in front of the drawn phone and
 * the palm continues below it.
 *
 * Every length derives from one custom property, --s: the width of the phone's
 * screen in CSS pixels. HAND is the hand image's geometry in its own pixels.
 *
 * The reel on the phone runs only while it is on screen.
 */
const HAND = {
  /** public/images/showcase/hand-*.webp, as printed by build-showcase.mjs */
  width: 1479,
  height: 2221,
  /** where the drawn phone goes: outline, corner radius, titanium band and black bezel */
  device: { x: 128, y: 30, w: 796, h: 1658, r: 151, frame: 10, bezel: 18 },
  /** the phone's display; the cards are cropped to its aspect */
  screen: { x: 156, y: 58, w: 740, h: 1602 },
}
/** A card's intrinsic size at 1x, for the img width/height attributes. */
const CARD = { w: 288, h: Math.round((288 * HAND.screen.h) / HAND.screen.w) }

const src = (slug: string, w: 288 | 576) => `/images/showcase/${slug}-${w}.webp`
const srcset = (slug: string) => `${src(slug, 288)} 288w, ${src(slug, 576)} 576w`
// A card is at most 288 CSS px wide (see --s), 170 on a phone.
const cardSizes = '(max-width: 600px) 170px, 288px'

// The reel ends on a copy of its first screen, so the loop restarts invisibly.
const reel = [...SHOWCASE_REEL, SHOWCASE_REEL[0]]

/** Dark status bar text on a light screen, white on a dark one, as iOS does. */
const lightTop = (hex = '#000000') => {
  const n = Number.parseInt(hex.slice(1), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 140
}

const screen = ref<HTMLElement | null>(null)
const playing = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (!screen.value || !('IntersectionObserver' in window)) {
    playing.value = true
    return
  }
  observer = new IntersectionObserver(([entry]) => (playing.value = entry.isIntersecting))
  observer.observe(screen.value)
})
onBeforeUnmount(() => observer?.disconnect())

const geometry = {
  '--hand-w': HAND.width,
  '--hand-h': HAND.height,
  '--hole-x': HAND.screen.x,
  '--hole-y': HAND.screen.y,
  '--hole-w': HAND.screen.w,
  '--hole-h': HAND.screen.h,
  '--dev-x': HAND.device.x,
  '--dev-y': HAND.device.y,
  '--dev-w': HAND.device.w,
  '--dev-h': HAND.device.h,
  '--dev-r': HAND.device.r,
  '--dev-frame': HAND.device.frame,
  '--dev-bezel': HAND.device.bezel,
  '--reel-steps': reel.length,
}
</script>

<template>
  <section id="apps" class="lp-section sc" aria-labelledby="apps-title" :style="geometry">
    <div class="lp-wrap">
      <p class="lp-eyebrow">Apps I build for myself</p>
      <h2 id="apps-title" class="lp-h2">When a website is not enough, I build the <span class="lp-serif">app</span> too.</h2>
      <p class="lp-lead">
        These are my own, designed and built end to end, and I use them every day: Hushkey keeps my passwords in sync between
        phone and PC, Shiftbell will not let me forget to clock in, and Tally tracks who has paid their share of the family
        plan. Plus JGENTS, X-Ray Mirror and Notchpoint.
      </p>
    </div>

    <div class="sc__stage">
      <div class="sc__clip">
        <ul class="sc__wall">
          <template v-for="(row, r) in SHOWCASE_ROWS" :key="r">
            <li
              v-for="(shot, c) in row"
              :key="`${r}-${c}`"
              class="sc__card"
              :class="{ 'sc__card--slot': !shot, 'sc__card--right': c > 2 }"
              :aria-hidden="shot ? undefined : 'true'"
            >
              <template v-if="shot">
                <img
                  :src="src(shot.slug, 288)"
                  :srcset="srcset(shot.slug)"
                  :sizes="cardSizes"
                  :alt="`${shot.app}: ${shot.screen}`"
                  :width="CARD.w"
                  :height="CARD.h"
                  loading="lazy"
                  decoding="async"
                />
                <span class="sc__label" aria-hidden="true">
                  <strong>{{ shot.app }}</strong>
                  {{ shot.screen }}
                </span>
              </template>
            </li>
          </template>
        </ul>
      </div>

      <div class="sc__track" aria-hidden="true">
        <div class="sc__hand">
          <div class="sc__device">
            <div class="sc__phone">
              <span class="sc__btn sc__btn--action" />
              <span class="sc__btn sc__btn--up" />
              <span class="sc__btn sc__btn--down" />
              <span class="sc__btn sc__btn--side" />
              <div class="sc__glass">
                <div ref="screen" class="sc__screen" :class="{ 'is-playing': playing }">
                  <div class="sc__reel">
                    <div
                      v-for="(shot, i) in reel"
                      :key="i"
                      class="sc__frame"
                      :class="{ 'sc__frame--light': lightTop(shot.top) }"
                      :style="{ background: shot.top }"
                    >
                      <div class="sc__status">
                        <span class="sc__time">9:41</span>
                        <span class="sc__icons">
                          <svg viewBox="0 0 18 12" class="sc__signal"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                          <svg viewBox="0 0 16 12" class="sc__wifi"><path d="M8 11.6 5.7 9.3a3.3 3.3 0 0 1 4.6 0L8 11.6Zm-4-4A5.7 5.7 0 0 1 12 7.6l1.5-1.5a7.8 7.8 0 0 0-11 0L4 7.6ZM.9 4.5a10.1 10.1 0 0 1 14.2 0l1-1a11.5 11.5 0 0 0-16.2 0l1 1Z" /></svg>
                          <svg viewBox="0 0 27 12" class="sc__battery"><rect x="0.5" y="0.5" width="22" height="11" rx="3.4" fill="none" stroke="currentColor" stroke-opacity="0.4" /><rect x="2" y="2" width="19" height="8" rx="2" /><path d="M24 4v4a2.2 2.2 0 0 0 0-4Z" fill-opacity="0.45" /></svg>
                        </span>
                      </div>
                      <img
                        :src="src(shot.slug, 288)"
                        :srcset="srcset(shot.slug)"
                        :sizes="cardSizes"
                        alt=""
                        :width="CARD.w"
                        :height="CARD.h"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                  <span class="sc__island" />
                </div>
              </div>
            </div>
            <img
              class="sc__hand-img"
              src="/images/showcase/hand-744.webp"
              srcset="/images/showcase/hand-744.webp 744w, /images/showcase/hand-1376.webp 1376w"
              sizes="(max-width: 600px) 345px, 580px"
              alt=""
              :width="HAND.width"
              :height="HAND.height"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * Always dark, in both page themes: the screens are mostly dark apps, and the
 * hand was cut out for a dark ground. The page's own tokens are re-pointed
 * here so the shared heading styles follow.
 */
.sc {
  --lp-ink: #f3efe6;
  --lp-muted: #b3ada1;
  --lp-faint: #8f897d;
  --lp-accent: #e8d4a0;
  --lp-line: rgba(243, 239, 230, 0.1);

  /*
   * One phone screen's width; everything else follows from it. Capped so the
   * whole hand (hand-h * k tall) fits under the header while it is pinned.
   */
  --s: clamp(150px, min(23vw, calc((100vh - 110px) * var(--hole-w) / var(--hand-h))), 288px);
  --k: calc(var(--s) / var(--hole-w));
  --card-h: calc(var(--hole-h) * var(--k));
  --gap: calc(var(--s) * 0.085);
  --radius: calc(var(--s) * 0.115);

  position: relative;
  padding-bottom: 0;
  background: #070605;
  color: var(--lp-ink);
}
/*
 * Where the wall ends, the arm runs on under the next section. A hairline
 * over the hand marks that edge, so in dark mode, where the next section is
 * nearly as dark, the arm reads as going under it and not as cut off.
 */
.sc::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  z-index: 3;
  height: 1px;
  background: rgba(243, 239, 230, 0.1);
  pointer-events: none;
}
@supports (height: 100svh) {
  .sc {
    --s: clamp(150px, min(23vw, calc((100svh - 110px) * var(--hole-w) / var(--hand-h))), 288px);
  }
}
@media (max-width: 600px) {
  .sc {
    --s: clamp(132px, 40vw, 170px);
  }
}

/*
 * The stage: the wall, with room above for the phone to start in the first
 * row's slot (the screen's top offset in the hand image) and room below for
 * the rest of the hand when it settles into the last row's slot.
 */
.sc__stage {
  position: relative;
  margin-top: clamp(48px, 7vw, 88px);
  padding-top: calc(var(--hole-y) * var(--k));
  padding-bottom: calc((var(--hand-h) - var(--hole-y) - var(--hole-h)) * var(--k));
}

/* Clips the wall's outer columns at the screen edge. `clip`, not `hidden`, so it never becomes a scroll container. */
.sc__clip {
  overflow: hidden;
  overflow: clip;
}

.sc__wall {
  display: grid;
  grid-template-columns: repeat(5, var(--s));
  gap: var(--gap);
  width: calc(var(--s) * 5 + var(--gap) * 4);
  margin-left: calc(50% - (var(--s) * 5 + var(--gap) * 4) / 2);
}

.sc__card {
  position: relative;
  height: var(--card-h);
  overflow: hidden;
  border-radius: var(--radius);
  background: #15130f;
  box-shadow:
    0 0 0 1px rgba(243, 239, 230, 0.07),
    0 24px 48px -28px rgba(0, 0, 0, 0.9);
}
.sc__card--slot {
  background: none;
  box-shadow: none;
}
.sc__card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

/* The app's name, on hover only: the screens speak for themselves while scrolling. */
.sc__label {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 48px 18px 18px;
  background: linear-gradient(to top, rgba(7, 6, 5, 0.92), rgba(7, 6, 5, 0));
  font-size: 14px;
  line-height: 1.35;
  color: var(--lp-muted);
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 0.25s ease,
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.sc__label strong {
  font-size: 17px;
  font-weight: 600;
  color: var(--lp-ink);
}
/* The fingers cover the inner edge of the card left of the hand and the thumb the card right of it: keep the label on the outer side. */
.sc__card--right .sc__label {
  align-items: flex-end;
  text-align: right;
}
@media (hover: hover) {
  .sc__card:hover .sc__label {
    opacity: 1;
    transform: none;
  }
}

/* ---------- The hand ---------- */

.sc__track {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.sc__hand {
  position: sticky;
  bottom: 0;
  flex: none;
  margin-top: auto;
  height: calc(var(--hand-h) * var(--k));
  overflow: hidden;
  /*
   * No fade at the bottom: a fade makes the palm see-through over the cards.
   * The box's bottom edge is always either the bottom of the screen (pinned)
   * or the section's bottom edge (at rest), so the arm is never cut mid-wall.
   */
}

.sc__device {
  position: absolute;
  top: 0;
  left: calc(50% - (var(--hole-x) + var(--hole-w) / 2) * var(--k));
  width: calc(var(--hand-w) * var(--k));
  height: calc(var(--hand-h) * var(--k));
}

/* The fingers in front of the phone; their shadow falls on it and on the wall. */
.sc__hand-img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 calc(10 * var(--k)) calc(14 * var(--k)) rgba(0, 0, 0, 0.35));
}

/* ---------- The phone ---------- */

/*
 * Natural titanium: a brushed band, darker where it turns away at the sides,
 * a highlight along the top, and a hairline where it meets the glass.
 */
.sc__phone {
  position: absolute;
  left: calc(var(--dev-x) * var(--k));
  top: calc(var(--dev-y) * var(--k));
  width: calc(var(--dev-w) * var(--k));
  height: calc(var(--dev-h) * var(--k));
  padding: calc(var(--dev-frame) * var(--k));
  border-radius: calc(var(--dev-r) * var(--k));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 12%, rgba(0, 0, 0, 0) 85%, rgba(0, 0, 0, 0.22)),
    linear-gradient(90deg, #7e8085 0%, #c9cbcf 2.5%, #eef0f2 6%, #b5b7bb 14%, #d9dbde 50%, #b5b7bb 86%, #eceef0 94%, #c4c6ca 97.5%, #7a7c81 100%);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.35),
    0 calc(40 * var(--k)) calc(70 * var(--k)) calc(-10 * var(--k)) rgba(0, 0, 0, 0.7);
}

/* The black border around the display, with the faint edge of the cover glass. */
.sc__glass {
  height: 100%;
  padding: calc(var(--dev-bezel) * var(--k));
  border-radius: calc((var(--dev-r) - var(--dev-frame)) * var(--k));
  background: #040404;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.8),
    inset 0 0 0 1px rgba(255, 255, 255, 0.07);
}

.sc__screen {
  position: relative;
  height: 100%;
  overflow: hidden;
  border-radius: calc((var(--dev-r) - var(--dev-frame) - var(--dev-bezel)) * var(--k));
  background: #000;
  /* Keeps the rounded clip on the moving reel in Safari. */
  isolation: isolate;
}
/* A faint reflection on the glass. */
.sc__screen::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(118deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0.03) 28%, rgba(255, 255, 255, 0) 42%);
  pointer-events: none;
}

/* Action button and volume on the left, the side button on the right, as on an iPhone 15 Pro. */
.sc__btn {
  position: absolute;
  width: calc(5 * var(--k));
  border-radius: calc(3 * var(--k));
  background: linear-gradient(90deg, #6f7176, #d6d8db 45%, #9a9ca0);
}
.sc__btn--action,
.sc__btn--up,
.sc__btn--down {
  left: calc(-4 * var(--k));
}
.sc__btn--side {
  right: calc(-4 * var(--k));
}
.sc__btn--action {
  top: 19.5%;
  height: 3.6%;
}
.sc__btn--up {
  top: 26.5%;
  height: 6%;
}
.sc__btn--down {
  top: 34%;
  height: 6%;
}
.sc__btn--side {
  top: 28%;
  height: 9.5%;
}

.sc__island {
  position: absolute;
  z-index: 3;
  top: calc(var(--card-h) * 0.0135);
  left: 50%;
  width: calc(var(--s) * 0.318);
  height: calc(var(--card-h) * 0.043);
  border-radius: 999px;
  background: radial-gradient(circle at 78% 50%, #1b2233 0, #0b0e16 calc(var(--s) * 0.012), #000 calc(var(--s) * 0.02));
  transform: translateX(-50%);
}

.sc__reel {
  display: flex;
  flex-direction: column;
  height: calc(100% * var(--reel-steps));
  animation: sc-reel 18s infinite;
  animation-play-state: paused;
}
.sc__screen.is-playing .sc__reel {
  animation-play-state: running;
}
/*
 * Each screen starts below an iOS status bar in its own top colour (the
 * screenshots have none of their own), so the Dynamic Island never sits on an
 * app's title.
 */
.sc__frame {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  padding-top: calc(var(--card-h) * 0.069);
  color: #fff;
}
.sc__frame--light {
  color: #111;
}
.sc__frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.sc__status {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(var(--card-h) * 0.069);
  padding-inline: calc(var(--s) * 0.105) calc(var(--s) * 0.075);
  padding-top: calc(var(--card-h) * 0.006);
}
.sc__time {
  font: 600 calc(var(--s) * 0.043) / 1 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
  letter-spacing: -0.01em;
}
.sc__icons {
  display: flex;
  align-items: center;
  gap: calc(var(--s) * 0.014);
}
.sc__icons svg {
  display: block;
  height: calc(var(--s) * 0.03);
  width: auto;
  fill: currentColor;
}
.sc__icons .sc__battery {
  height: calc(var(--s) * 0.032);
}

/*
 * Four screens and a copy of the first. Each holds, then slides up like a
 * swipe; the last step lands on the copy and the loop restarts on the
 * original, which looks the same. Steps are 20% of the strip's height.
 */
@keyframes sc-reel {
  0%,
  17% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
  }
  21%,
  38% {
    transform: translateY(-20%);
    animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
  }
  42%,
  59% {
    transform: translateY(-40%);
    animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
  }
  63%,
  80% {
    transform: translateY(-60%);
    animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
  }
  84%,
  100% {
    transform: translateY(-80%);
  }
}
</style>
