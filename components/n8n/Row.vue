<script setup lang="ts">
import type { CatalogEntry } from '~/utils/n8n/types'

/**
 * One workflow, as a line rather than a card.
 *
 * The card is for browsing - it gives three lines of summary and room to
 * decide. This is for looking something up: one workflow per line, names in a
 * column you can run your eye down, and about four times as many on screen.
 *
 * It carries less on purpose. The category goes (it is the longest thing on a
 * card and the rail already filters by it) and the summary shrinks to
 * whatever is left after the name, disappearing entirely on a narrow screen
 * where it would push the name out instead.
 */
const props = defineProps<{ entry: CatalogEntry }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="n8-row" :title="props.entry.summary" @click="$emit('open')">
    <N8nBubbles :services="props.entry.integrations" :max="2" />

    <span class="n8-row__text">
      <span class="n8-row__name">{{ props.entry.name }}</span>
      <span class="n8-row__summary">{{ props.entry.summary }}</span>
    </span>

    <span class="n8-row__meta">
      <span class="n8-tag n8-tag--trigger">{{ props.entry.trigger }}</span>
      <span class="n8-tag n8-tag--steps">
        {{ props.entry.steps }} step{{ props.entry.steps === 1 ? '' : 's' }}
      </span>
    </span>
  </button>
</template>
