<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { CAKE_FIRST, CAKE_LAYERS, CAKE_PLATE, CAKE_TIMING } from '../../utils/monthsary/cake'

/**
 * The cake, after Marco Barría's "new cake" on CodePen (MIT; see
 * THIRD-PARTY-NOTICES.md): each layer drops in and squashes onto the plate,
 * the cream drips down the sides, and a candle falls in and lights.
 *
 * The layers are SVG path morphs (SMIL `<animate>`), chained so each starts
 * when the one below lands. Every path starts hidden and is shown by a `<set>`
 * on the same beat its morph begins: the box is much taller than the cake, and
 * the cream's first frame would otherwise hang over the words as a thin line.
 *
 * Replaying means remounting - a finished SMIL chain keeps its upper layers
 * frozen on the plate, so restarting it in place would drop the bottom layer
 * through a finished cake.
 */

const props = defineProps<{
  /** Starts the build. */
  running: boolean
  /** Skips the build and the flicker: the finished cake, a still flame. */
  reduced: boolean
  /** Rendered width in CSS pixels; everything inside scales from it. */
  width: number
}>()

const emit = defineEmits<{ blown: [] }>()

const svg = ref<SVGSVGElement | null>(null)
const lit = ref(false)
const out = ref(false)

let lighting = 0

watch(
  () => props.running,
  (running) => {
    if (!running) return
    if (props.reduced) {
      lit.value = true
      return
    }
    const first = svg.value?.querySelector<SVGAnimationElement>(`#${CAKE_FIRST}`)
    first?.beginElement()
    lighting = window.setTimeout(() => (lit.value = true), CAKE_TIMING.flame * 1000)
  },
)

onBeforeUnmount(() => window.clearTimeout(lighting))

function blow() {
  if (!lit.value || out.value) return
  out.value = true
  emit('blown')
}
</script>

<template>
  <div
    class="cake"
    :class="{ 'is-running': running, 'is-lit': lit, 'is-out': out, 'is-reduced': reduced }"
    :style="{ '--u': `${width / 200}px`, '--candle-at': `${CAKE_TIMING.candle}s`, '--flame-at': `${CAKE_TIMING.flame}s` }"
  >
    <div class="cake__plate-glow" aria-hidden="true" />
    <div class="cake__glow" aria-hidden="true" />

    <svg ref="svg" class="cake__svg" viewBox="0 0 200 500" aria-hidden="true">
      <path
        v-for="layer in CAKE_LAYERS"
        :key="layer.id"
        :fill="layer.fill"
        :d="reduced ? layer.final : layer.start"
        :visibility="reduced ? 'visible' : 'hidden'"
      >
        <template v-if="!reduced">
          <animate
            :id="layer.id"
            attributeName="d"
            calcMode="spline"
            :keySplines="layer.keySplines"
            :begin="layer.begin"
            :dur="layer.dur"
            fill="freeze"
            :values="layer.values"
          />
          <set attributeName="visibility" to="visible" :begin="`${layer.id}.begin`" fill="freeze" />
        </template>
      </path>
      <rect
        class="cake__plate"
        :x="CAKE_PLATE.x"
        :y="CAKE_PLATE.y"
        :width="CAKE_PLATE.width"
        :height="CAKE_PLATE.height"
        :fill="CAKE_PLATE.fill"
      />
    </svg>

    <div class="cake__candle" aria-hidden="true">
      <span v-for="n in 5" :key="n" class="cake__flame" />
      <span v-for="n in 3" :key="`smoke-${n}`" class="cake__smoke" />
    </div>

    <button
      v-if="lit && !out"
      type="button"
      class="cake__blow"
      aria-label="Blow out the candle"
      @click="blow"
    />
  </div>
</template>

<style scoped>
/*
 * Every length is in viewBox units through --u, so the candle and flame stay
 * glued to the SVG at any size. The original was written for a 200px-wide
 * cake, so its pixel values carry over as unit counts unchanged.
 */
.cake {
  position: absolute;
  pointer-events: none;
}

.cake__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* A soft pool of light on the table, there before the first layer lands. */
.cake__plate-glow {
  position: absolute;
  left: 50%;
  top: calc(478 * var(--u));
  width: calc(300 * var(--u));
  height: calc(70 * var(--u));
  transform: translate(-50%, -50%);
  background: radial-gradient(closest-side, rgba(255, 143, 177, 0.32), rgba(255, 143, 177, 0) 100%);
  opacity: 0;
  transition: opacity 1.2s ease;
}

/* The plate is set out when the build starts; on the gate it read as a stray line. */
.cake__plate {
  opacity: 0;
  transition: opacity 0.6s ease;
}

.is-running .cake__plate,
.is-running .cake__plate-glow {
  opacity: 1;
}

/* Candlelight. Fades with the flame. */
.cake__glow {
  position: absolute;
  left: 50%;
  top: calc(355 * var(--u));
  width: calc(240 * var(--u));
  height: calc(240 * var(--u));
  transform: translate(-50%, -50%);
  background: radial-gradient(closest-side, rgba(255, 200, 130, 0.34), rgba(255, 140, 170, 0.1) 55%, rgba(255, 140, 170, 0) 100%);
  opacity: 0;
  transition: opacity 1.4s ease;
}

.is-lit .cake__glow {
  opacity: 1;
}

.is-out .cake__glow {
  opacity: 0;
  transition-duration: 0.5s;
}

.cake__candle {
  position: absolute;
  left: 50%;
  top: calc(375 * var(--u));
  width: calc(5 * var(--u));
  height: calc(35 * var(--u));
  margin-left: calc(-2.5 * var(--u));
  border-radius: calc(2.5 * var(--u));
  background: #ffffff;
  opacity: 0;
  transform: translateY(calc(-300 * var(--u)));
  backface-visibility: hidden;
}

.cake__candle::before,
.cake__candle::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: calc(2.2 * var(--u));
  background: rgba(255, 93, 143, 0.6);
}

.cake__candle::before {
  top: 45%;
}

.cake__candle::after {
  top: 25%;
}

.is-running .cake__candle {
  animation: cake-candle-in 500ms ease-out var(--candle-at) forwards;
}

.is-reduced .cake__candle {
  opacity: 1;
  transform: none;
  animation: none;
}

@keyframes cake-candle-in {
  0% {
    opacity: 0;
    transform: translateY(calc(-300 * var(--u)));
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Five translucent flames on different periods: their overlap is the flicker. */
.cake__flame {
  position: absolute;
  top: calc(-20 * var(--u));
  left: 50%;
  width: calc(6.667 * var(--u));
  height: calc(18 * var(--u));
  margin-left: calc(-3.333 * var(--u));
  border-radius: 100%;
}

.is-running .cake__flame:nth-child(1) {
  animation: cake-flame 2s var(--flame-at) infinite;
}
.is-running .cake__flame:nth-child(2) {
  animation: cake-flame 1.5s var(--flame-at) infinite;
}
.is-running .cake__flame:nth-child(3) {
  animation: cake-flame 1s var(--flame-at) infinite;
}
.is-running .cake__flame:nth-child(4) {
  animation: cake-flame 0.5s var(--flame-at) infinite;
}
.is-running .cake__flame:nth-child(5) {
  animation: cake-flame 0.2s var(--flame-at) infinite;
}

/* Reduced motion: one steady flame instead of the flicker. */
.is-reduced.is-lit .cake__flame:nth-child(1) {
  animation: none;
  background: rgba(254, 220, 120, 0.85);
  box-shadow: 0 0 calc(40 * var(--u)) calc(10 * var(--u)) rgba(248, 233, 209, 0.25);
}

.is-out .cake__flame {
  animation: none !important;
  background: none !important;
  box-shadow: none !important;
}

@keyframes cake-flame {
  0%,
  100% {
    background: rgba(254, 248, 97, 0.5);
    box-shadow: 0 0 calc(40 * var(--u)) calc(10 * var(--u)) rgba(248, 233, 209, 0.2);
    transform: translateY(0) scale(1);
  }
  50% {
    background: rgba(255, 50, 0, 0.1);
    box-shadow: 0 0 calc(40 * var(--u)) calc(20 * var(--u)) rgba(248, 233, 209, 0.2);
    transform: translateY(calc(-20 * var(--u))) scale(0);
  }
}

/* The wisp after the candle goes out. Translate and opacity only. */
.cake__smoke {
  position: absolute;
  top: calc(-8 * var(--u));
  left: 50%;
  width: calc(7 * var(--u));
  height: calc(7 * var(--u));
  margin-left: calc(-3.5 * var(--u));
  border-radius: 50%;
  background: rgba(236, 226, 236, 0.55);
  filter: blur(calc(1.6 * var(--u)));
  opacity: 0;
}

.is-out .cake__smoke {
  animation: cake-smoke 1.8s ease-out forwards;
}
.is-out .cake__smoke:nth-of-type(7) {
  animation-delay: 0.15s;
  --drift: -1;
}
.is-out .cake__smoke:nth-of-type(8) {
  animation-delay: 0.3s;
  --drift: 0.6;
}

@keyframes cake-smoke {
  0% {
    opacity: 0.75;
    transform: translate(0, 0);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--drift, 1) * 10 * var(--u)), calc(-70 * var(--u)));
  }
}

/* The candle and its flame, made tappable. Generous, because it is small on a phone. */
.cake__blow {
  position: absolute;
  left: 50%;
  top: calc(370 * var(--u));
  width: max(64px, calc(60 * var(--u)));
  height: max(88px, calc(90 * var(--u)));
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

/* A slow warm pulse round the flame: "tap here", without drawing a box on the cake. */
.cake__blow::after {
  content: '';
  position: absolute;
  /* Centred with auto margins: transform is taken by the pulse. */
  left: 0;
  right: 0;
  top: 22%;
  width: max(64px, calc(60 * var(--u)));
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 214, 150, 0.45), rgba(255, 143, 177, 0.18) 60%, rgba(255, 143, 177, 0) 100%);
  opacity: 0;
  animation: cake-beckon 2.4s ease-out 0.6s infinite;
}

.cake__blow:focus-visible {
  outline: 2px solid #ffd1dc;
  outline-offset: 2px;
}

@keyframes cake-beckon {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cake__blow::after {
    animation: none;
    opacity: 0.6;
  }
}
</style>
