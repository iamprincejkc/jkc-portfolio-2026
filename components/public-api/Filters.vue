<script setup lang="ts">
import { computed } from 'vue'
import { AUTHS, CORS_VALUES, FACETS, facetCounts, readyCount } from '~/utils/public-api/search'
import type { Facet, Filters, IndexedEntry } from '~/utils/public-api/search'
import type { CategoryStat } from '~/utils/public-api/types'

/**
 * The filter rail.
 *
 * Every option carries the number of results it would produce, counted with
 * that facet's own selection lifted. That is the part worth getting right: if
 * "Finance" is selected and the counts are taken from the filtered set, every
 * other category reads zero and the rail becomes a dead end. Lifting the facet
 * being counted means the numbers answer the question a person is actually
 * asking - "what happens if I click this instead".
 *
 * An option that would produce nothing is not rendered, unless it is the
 * current selection: a control you can press to reach an empty page is a
 * worse offer than no control.
 *
 * Browser-ready sits above the facets and is styled as a switch rather than a
 * chip, because it is not one value of a category - it is the whole question
 * the directory exists to answer, and it cuts 1,773 entries down to the few
 * hundred you can call from a page without standing up a proxy first.
 */
const props = defineProps<{ categories: CategoryStat[]; index: IndexedEntry[]; filters: Filters }>()
const emit = defineEmits<{ 'update:filters': [value: Filters]; reset: [] }>()

interface Group {
  key: Facet
  label: string
  /** What the group is for, when the label alone is a term of art. */
  hint?: string
  options: string[]
}

const groups = computed<Group[]>(() => [
  {
    key: 'auth',
    label: 'Access',
    hint: 'What it wants before it answers',
    options: [...AUTHS],
  },
  {
    key: 'cors',
    label: 'CORS',
    hint: 'Whether a browser may call it directly',
    options: [...CORS_VALUES],
  },
  {
    key: 'category',
    label: 'Category',
    options: props.categories.map((category) => category.name),
  },
])

/** Counts per facet, computed once per render rather than once per option. */
const counts = computed(() => {
  const result = {} as Record<Facet, Map<string, number>>
  for (const facet of FACETS) result[facet] = facetCounts(props.index, props.filters, facet)
  return result
})

const ready = computed(() => readyCount(props.index, props.filters))

function optionsFor(group: Group): string[] {
  return group.options.filter(
    (option) => option && (counts.value[group.key].get(option) || props.filters[group.key] === option),
  )
}

/** The label an option carries in the rail, where the column is 264px wide. */
function labelFor(group: Group, option: string): string {
  if (group.key === 'auth' && option === 'None') return 'No key needed'
  if (group.key === 'auth' && option === 'Other') return 'Custom header'
  if (group.key === 'cors') return option === 'Unknown' ? 'Unverified' : option === 'Yes' ? 'Allowed' : 'Refused'
  return option
}

const active = computed(() => FACETS.filter((facet) => props.filters[facet]).length + (props.filters.ready ? 1 : 0))

function toggle(key: Facet, value: string) {
  emit('update:filters', { ...props.filters, [key]: props.filters[key] === value ? '' : value })
}

function toggleReady() {
  emit('update:filters', { ...props.filters, ready: props.filters.ready ? '' : '1' })
}
</script>

<template>
  <!--
    `data-lenis-prevent` is required, not decorative. Lenis runs site-wide with
    `smoothWheel`, which swallows wheel events before they reach any inner
    scroller - so this rail would refuse to scroll while the page behind it
    moved instead.
  -->
  <div class="pa-rail" data-lenis-prevent>
    <button
      type="button"
      class="pa-switch"
      role="switch"
      :aria-checked="Boolean(props.filters.ready)"
      @click="toggleReady"
    >
      <span class="pa-switch__track"><span class="pa-switch__knob" /></span>
      <span class="pa-switch__text">
        <span class="pa-switch__label">
          <PublicApiIcon name="bolt" :size="12" />
          Browser-ready
        </span>
        <span class="pa-switch__note">No key, HTTPS and CORS &middot; {{ ready.toLocaleString() }}</span>
      </span>
    </button>

    <!--
      Each facet is a labelled group, so the toggles inside it are announced
      as "Animals, 26, not pressed" *within* "Category" rather than as
      fifty-one unrelated buttons in a row.
    -->
    <div
      v-for="group in groups"
      :key="group.key"
      class="pa-rail__group"
      :data-facet="group.key"
      role="group"
      :aria-labelledby="`pa-facet-${group.key}`"
    >
      <p :id="`pa-facet-${group.key}`" class="pa-eyebrow">{{ group.label }}</p>
      <p v-if="group.hint" class="pa-rail__hint">{{ group.hint }}</p>

      <div class="pa-rail__options">
        <button
          v-for="option in optionsFor(group)"
          :key="option"
          type="button"
          class="pa-option"
          :aria-pressed="props.filters[group.key] === option"
          :title="labelFor(group, option)"
          @click="toggle(group.key, option)"
        >
          <!--
            The label is its own element so it can be given an ellipsis.
            "Documents & Productivity" is wider than the rail, and a bare text
            node inside a nowrap control has nothing to truncate against.
          -->
          <span class="pa-option__label">{{ labelFor(group, option) }}</span>
          <span class="pa-option__count">{{ (counts[group.key].get(option) ?? 0).toLocaleString() }}</span>
        </button>
      </div>
    </div>

    <button v-if="active" type="button" class="pa-rail__reset" @click="emit('reset')">
      <PublicApiIcon name="close" :size="13" />
      Clear {{ active }} filter{{ active === 1 ? '' : 's' }}
    </button>
  </div>
</template>
