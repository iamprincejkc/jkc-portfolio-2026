<script setup lang="ts">
import type { ApiEntry } from '~/utils/public-api/types'

/**
 * One API, as an index card.
 *
 * A button rather than a link: opening an API puts a panel over the results
 * rather than navigating, and dressing that up as a link would promise a
 * back-button behaviour it does not have. The URL still changes - the page
 * writes the id into the query - so any entry is still shareable.
 *
 * The documentation link is a real anchor nested inside it, because that one
 * *is* a navigation, and it is the thing most people came for. A nested
 * interactive element is invalid inside a `<button>`, so the card is a
 * `<article>` carrying a full-bleed button behind its content: the button is
 * the click target for the whole card, the anchor sits above it, and both are
 * reachable by keyboard in the order they are read.
 *
 * Everything on the card exists to answer "is this the one" without opening
 * it: what it is called, what it does, who is actually behind it, and the
 * three facts that decide whether you can call it from where you are.
 */
const props = defineProps<{ entry: ApiEntry }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <article class="pa-card" :data-ready="props.entry.ready ? '' : null">
    <button type="button" class="pa-card__hit" @click="$emit('open')">
      <span class="pa-sr">Open {{ props.entry.name }}</span>
    </button>

    <div class="pa-card__head">
      <span class="pa-card__category">{{ props.entry.category }}</span>
      <span v-if="props.entry.ready" class="pa-card__ready" title="No key, HTTPS, CORS - callable from a page">
        <PublicApiIcon name="bolt" :size="11" />
        <span class="pa-sr">Browser-ready</span>
      </span>
    </div>

    <h3 class="pa-card__name">{{ props.entry.name }}</h3>
    <p v-if="props.entry.description" class="pa-card__desc">{{ props.entry.description }}</p>

    <div class="pa-card__foot">
      <PublicApiBadges :entry="props.entry" />
      <a
        class="pa-card__link"
        :href="props.entry.url"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
      >
        <span class="pa-card__host">{{ props.entry.host || 'docs' }}</span>
        <PublicApiIcon name="external" :size="13" />
        <span class="pa-sr">Open the {{ props.entry.name }} documentation in a new tab</span>
      </a>
    </div>
  </article>
</template>
