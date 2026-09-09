<script setup lang="ts">
/**
 * The page's icons, as one component.
 *
 * Twelve marks on a 24x24 grid with a 2px round-joined stroke, drawn to match
 * rather than collected from wherever. A shared component is also the only
 * arrangement in which the stroke weight cannot drift between one icon and the
 * next, which on a page this soft is the difference between a set and a pile.
 */
export type N8nIconName =
  | 'search'
  | 'close'
  | 'copy'
  | 'check'
  | 'download'
  | 'filter'
  | 'plus'
  | 'minus'
  | 'fit'
  | 'nodes'
  | 'alert'
  | 'sun'
  | 'moon'
  | 'cards'
  | 'rows'

const props = withDefaults(defineProps<{ name: N8nIconName; size?: number }>(), { size: 20 })

const PATHS: Record<N8nIconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9V6.5A1.5 1.5 0 0 1 10.5 5h7A1.5 1.5 0 0 1 19 6.5v7a1.5 1.5 0 0 1-1.5 1.5H15M6.5 9h7A1.5 1.5 0 0 1 15 10.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 17.5v-7A1.5 1.5 0 0 1 6.5 9Z',
  check: 'm5 12.5 4.5 4.5L19 7',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 19h14',
  filter: 'M4 6h16M7 12h10M10 18h4',
  plus: 'M12 6v12M6 12h12',
  minus: 'M6 12h12',
  fit: 'M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15',
  nodes: 'M6.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17.5 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9 7.6l6 3M9 16.4l6-3',
  alert: 'M12 8v5M12 16.5v.01M12 3.5 2.5 20h19L12 3.5Z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4',
  moon: 'M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z',
  cards: 'M4.5 5.5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1V9a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V5.5ZM14 5.5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1V9a1 1 0 0 1-1 1H15a1 1 0 0 1-1-1V5.5ZM4.5 15a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V15ZM14 15a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H15a1 1 0 0 1-1-1V15Z',
  rows: 'M4 6.5h16M4 12h16M4 17.5h16',
}
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="PATHS[props.name]" />
  </svg>
</template>
