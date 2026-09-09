<script setup lang="ts">
import type { CatalogEntry } from '~/utils/n8n/types'

/**
 * One workflow, as a lump of clay you can press.
 *
 * A button rather than a link: opening a workflow puts a dialog over the
 * results rather than navigating, and dressing that up as a link would promise
 * a back-button behaviour it does not have. The URL still changes - the page
 * writes the id into the query - so a workflow is still shareable.
 *
 * Everything on the card exists to answer "is this the one" without opening
 * it: what it is called, what its author said it does, what it talks to, how
 * it starts, and how big it is.
 */
const props = defineProps<{ entry: CatalogEntry }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="n8-card" @click="$emit('open')">
    <div class="n8-card__top">
      <N8nBubbles :services="props.entry.integrations" />
      <span class="n8-tag" :class="{ 'n8-tag--advanced': props.entry.complexity === 'Advanced' }">
        {{ props.entry.complexity }}
      </span>
    </div>

    <h3 class="n8-card__title">{{ props.entry.name }}</h3>
    <p class="n8-card__summary">{{ props.entry.summary }}</p>

    <div class="n8-card__foot">
      <span class="n8-tag n8-tag--trigger">{{ props.entry.trigger }}</span>
      <span class="n8-tag n8-tag--steps">
        {{ props.entry.steps }} step{{ props.entry.steps === 1 ? '' : 's' }}
      </span>
      <span class="n8-tag">{{ props.entry.category }}</span>
    </div>
  </button>
</template>
