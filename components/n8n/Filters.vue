<script setup lang="ts">
import { computed } from 'vue'
import { COMPLEXITIES, facetCounts, TRIGGERS, topIntegrations } from '~/utils/n8n/search'
import type { Filters, IndexedEntry } from '~/utils/n8n/search'
import type { CatalogEntry } from '~/utils/n8n/types'

/**
 * The filter rail.
 *
 * Every option carries the number of results it would produce, counted with
 * that facet's own selection lifted. That is the part worth getting right: if
 * "Webhook" is selected and the counts are taken from the filtered set, every
 * other trigger reads zero and the rail becomes a dead end. Lifting the facet
 * being counted means the numbers answer the question a person is actually
 * asking - "what happens if I click this instead".
 *
 * An option that would produce nothing is not rendered at all. A chip you can
 * press to reach an empty page is a worse offer than no chip.
 */
const props = defineProps<{ entries: CatalogEntry[]; index: IndexedEntry[]; filters: Filters }>()
const emit = defineEmits<{ 'update:filters': [value: Filters]; reset: [] }>()

const INTEGRATION_LIMIT = 14

const categories = computed(() => [...new Set(props.entries.map((entry) => entry.category))].sort())
const integrations = computed(() => topIntegrations(props.entries, INTEGRATION_LIMIT))

interface Group {
  key: keyof Filters
  label: string
  options: string[]
}

const groups = computed<Group[]>(() => [
  { key: 'category', label: 'Category', options: categories.value },
  { key: 'trigger', label: 'Starts with', options: [...TRIGGERS] },
  { key: 'complexity', label: 'Size', options: [...COMPLEXITIES] },
  { key: 'integration', label: 'Talks to', options: integrations.value },
])

/** Counts per facet, computed once per render rather than once per chip. */
const counts = computed(() => {
  const result = {} as Record<keyof Filters, Map<string, number>>
  for (const group of groups.value) result[group.key] = facetCounts(props.index, props.filters, group.key)
  return result
})

/**
 * The options actually worth offering.
 *
 * Empty is not a value: a filter stores "" to mean unset, so a nameless
 * option would render as a chip with no label that reports itself as pressed
 * and cannot be turned off. Zero-result options are dropped too, unless they
 * are the current selection - a chip you can press to reach an empty page is
 * a worse offer than no chip.
 */
function optionsFor(group: Group): string[] {
  return group.options.filter(
    (option) => option && (counts.value[group.key].get(option) || props.filters[group.key] === option),
  )
}

const active = computed(() =>
  (['category', 'trigger', 'complexity', 'integration'] as const).filter((key) => props.filters[key]),
)

function toggle(key: keyof Filters, value: string) {
  emit('update:filters', { ...props.filters, [key]: props.filters[key] === value ? '' : value })
}
</script>

<template>
  <!--
    `data-lenis-prevent` is required, not decorative. Lenis runs site-wide with
    `smoothWheel`, which swallows wheel events before they reach any inner
    scroller - so this rail would refuse to scroll while the page behind it
    moved instead.
  -->
  <div class="n8-rail" data-lenis-prevent>
    <div v-for="group in groups" :key="group.key" class="n8-rail__group">
      <p class="n8-eyebrow">{{ group.label }}</p>
      <div class="n8-rail__options">
        <button
          v-for="option in optionsFor(group)"
          :key="option"
          type="button"
          class="n8-chip"
          :aria-pressed="props.filters[group.key] === option"
          :title="option"
          @click="toggle(group.key, option)"
        >
          <!--
            The label is its own element so it can be given an ellipsis.
            "Cloud Storage & File Management" is wider than the rail, and a
            bare text node inside a nowrap chip has nothing to truncate.
          -->
          <span class="n8-chip__label">{{ option }}</span>
          <span class="n8-chip__count">{{ counts[group.key].get(option) ?? 0 }}</span>
        </button>
      </div>
    </div>

    <button v-if="active.length" type="button" class="n8-rail__reset" @click="emit('reset')">
      Clear {{ active.length }} filter{{ active.length === 1 ? '' : 's' }}
    </button>
  </div>
</template>
