<script setup lang="ts">
import type { ApiEntry } from '~/utils/public-api/types'

/**
 * One API, as a line in a table.
 *
 * The same information as the card at a quarter of the height, for scanning
 * rather than browsing. Same structure for the same reason: a full-bleed
 * button behind the content opens the panel, and the documentation anchor
 * sits above it.
 *
 * The description is allowed to be clipped here - it is the one field that
 * varies from three words to a full sentence, and letting it set the row
 * height would undo the point of a compact view. Every ancestor between it
 * and the fixed track is given `min-inline-size: 0` in the stylesheet, which
 * is what actually makes the ellipsis appear.
 */
const props = defineProps<{ entry: ApiEntry }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <article class="pa-row" :data-ready="props.entry.ready ? '' : null">
    <button type="button" class="pa-card__hit" @click="$emit('open')">
      <span class="pa-sr">Open {{ props.entry.name }}</span>
    </button>

    <div class="pa-row__main">
      <h3 class="pa-row__name">
        <span v-if="props.entry.ready" class="pa-row__ready" title="No key, HTTPS, CORS - callable from a page">
          <PublicApiIcon name="bolt" :size="11" />
          <span class="pa-sr">Browser-ready.</span>
        </span>
        {{ props.entry.name }}
      </h3>
      <p class="pa-row__desc">{{ props.entry.description }}</p>
    </div>

    <span class="pa-row__category">{{ props.entry.category }}</span>

    <PublicApiBadges :entry="props.entry" compact />

    <a class="pa-row__link" :href="props.entry.url" target="_blank" rel="noopener noreferrer" @click.stop>
      <PublicApiIcon name="external" :size="14" />
      <span class="pa-sr">Open the {{ props.entry.name }} documentation in a new tab</span>
    </a>
  </article>
</template>
