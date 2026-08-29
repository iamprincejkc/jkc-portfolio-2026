<script setup lang="ts">
import { ICON_PATHS, type IconName } from '~/utils/qr/icon-paths'

const props = defineProps<{
  name: IconName
  /**
   * Give this only when the icon carries meaning the surrounding text does
   * not. Without it the icon is hidden from assistive tech, which is right for
   * an icon sitting next to its own label.
   */
  title?: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="props.title ? undefined : 'true'"
    :role="props.title ? 'img' : undefined"
  >
    <title v-if="props.title">{{ props.title }}</title>
    <path :d="ICON_PATHS[props.name]" />
  </svg>
</template>
