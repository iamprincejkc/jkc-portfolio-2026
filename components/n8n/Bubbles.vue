<script setup lang="ts">
import { computed } from 'vue'
import { bubbleColour, bubbleInitials } from '~/utils/n8n/palette'

/**
 * The overlapping stack of service marks on a card.
 *
 * There is no icon set that covers the four hundred services in this library,
 * and a row of identical grey placeholders would say less than nothing. An
 * initial on a coloured lump is honest about being a stand-in, is recognisable
 * once you have seen a service twice, and suits a page made of clay.
 *
 * The stack is decorative in the accessibility sense - the services are named
 * in the card's own text - so it carries one label for the group rather than
 * twelve for the pieces.
 */
const props = withDefaults(defineProps<{ services: string[]; max?: number }>(), { max: 3 })

const shown = computed(() => props.services.slice(0, props.max))
const overflow = computed(() => Math.max(0, props.services.length - props.max))
</script>

<template>
  <div v-if="props.services.length" class="n8-bubbles" :title="props.services.join(', ')">
    <span
      v-for="service in shown"
      :key="service"
      class="n8-bubble"
      :style="{ '--n8-bubble': bubbleColour(service) }"
      aria-hidden="true"
    >
      {{ bubbleInitials(service) }}
    </span>
    <span v-if="overflow" class="n8-bubble n8-bubble--more" aria-hidden="true">+{{ overflow }}</span>
  </div>
</template>
