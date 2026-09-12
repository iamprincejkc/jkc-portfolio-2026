<script setup lang="ts">
/**
 * The page's icons, as one component.
 *
 * Every mark is drawn on the same 24x24 grid with a 1.5px round-joined
 * stroke - finer than the 2px the other tools use, because this page is built
 * out of 1px hairlines and 13px text, and a heavier icon next to that reads as
 * a different set. A shared component is also the only arrangement in which
 * the stroke weight cannot drift between one icon and the next.
 *
 * Marks only, never emoji: an emoji is a font the browser picks, so its
 * weight, colour and alignment are outside the design's control and change
 * between platforms.
 */
export type PublicApiIconName =
  | 'search'
  | 'close'
  | 'filter'
  | 'check'
  | 'copy'
  | 'external'
  | 'sun'
  | 'moon'
  | 'key'
  | 'open'
  | 'lock'
  | 'globe'
  | 'bolt'
  | 'cards'
  | 'rows'
  | 'alert'
  | 'arrow'
  | 'chevron'

const props = withDefaults(defineProps<{ name: PublicApiIconName; size?: number }>(), { size: 16 })

const PATHS: Record<PublicApiIconName, string> = {
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM19.5 19.5 15.6 15.6',
  close: 'M6 6l12 12M18 6 6 18',
  filter: 'M4 7h16M7 12h10M10 17h4',
  check: 'm5 12.5 4.5 4.5L19 7',
  copy: 'M9 9V6.5A1.5 1.5 0 0 1 10.5 5h7A1.5 1.5 0 0 1 19 6.5v7a1.5 1.5 0 0 1-1.5 1.5H15M6.5 9h7A1.5 1.5 0 0 1 15 10.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 17.5v-7A1.5 1.5 0 0 1 6.5 9Z',
  external: 'M14 5h5v5M19 5l-8 8M17 14.5v3.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 6 7h3.5',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  moon: 'M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z',
  // A key: the ring, the shaft, and one ward. "You need credentials."
  key: 'M15.5 4.5a4.5 4.5 0 1 0-3.2 7.7L4.5 20v-2.5H7v-2.5h2.5l2.8-2.8',
  // An open padlock: the shackle swung clear of the body. "No key needed."
  open: 'M8 10V7a4 4 0 0 1 7.6-1.8M5.5 10h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
  lock: 'M8 10V7a4 4 0 0 1 8 0v3M5.5 10h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c-4 4.8-4 13.2 0 18M12 3c4 4.8 4 13.2 0 18',
  bolt: 'M13.5 3 5 13.5h6L10.5 21 19 10.5h-6L13.5 3Z',
  cards: 'M4.5 5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4ZM13.5 5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4ZM4.5 14.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4ZM13.5 14.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z',
  rows: 'M4 7h16M4 12h16M4 17h16',
  alert: 'M12 8.5v4.5M12 16.5v.01M12 4 3 19.5h18L12 4Z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
}

/** Filled, not stroked: a solid mark reads at 8px where a stroked one blurs. */
const SOLID = new Set<PublicApiIconName>(['bolt'])
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    :fill="SOLID.has(props.name) ? 'currentColor' : 'none'"
    :stroke="SOLID.has(props.name) ? 'none' : 'currentColor'"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="PATHS[props.name]" />
  </svg>
</template>
