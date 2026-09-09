/**
 * The colours the diagram and the cards are painted with.
 *
 * Two different jobs. `KIND_COLOURS` is semantic - six fixed colours for the
 * six things a node can be, so the shape of a workflow is readable before any
 * label is. `bubbleColour` is identity - four hundred services need to be
 * distinguishable at 34px, and no meaning can be attached to which colour a
 * service gets, so the only requirements are that it is stable and that the
 * text on it is legible.
 *
 * Stable matters more than it sounds: Slack has to be the same colour on every
 * card, on every visit, or the bubbles stop being recognisable and become
 * decoration.
 */
import type { NodeKind } from './types'

export const KIND_COLOURS: Record<NodeKind, string> = {
  trigger: '#16a97a',
  ai: '#7c5cf0',
  logic: '#d98514',
  data: '#2b93d6',
  app: '#ea4b71',
  output: '#6b7a90',
}

export const KIND_LABELS: Record<NodeKind, string> = {
  trigger: 'Trigger',
  ai: 'AI',
  logic: 'Flow',
  data: 'Data',
  app: 'App',
  output: 'Output',
}

/**
 * Bubble colours, all tested against white text at 13px bold.
 *
 * Every one clears 4.5:1 against #fff, so a service's initial is legible
 * whichever bubble it lands in - which is what lets the colour be arbitrary.
 */
const BUBBLES = [
  '#c92f55',
  '#b5452e',
  '#996515',
  '#4d7c1f',
  '#137a5c',
  '#0f7490',
  '#1f6fb8',
  '#4b52c8',
  '#7040c0',
  '#a2318f',
  '#8a5a2b',
  '#3f6b6b',
]

/**
 * A stable colour for a service name.
 *
 * FNV-1a: a few lines, no dependency, and well enough distributed that two
 * services sitting next to each other on a card rarely collide. A collision is
 * cosmetic anyway - the initial still differs.
 */
export function bubbleColour(name: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return BUBBLES[Math.abs(hash) % BUBBLES.length]
}

/**
 * The letters shown in a bubble.
 *
 * Two letters for a multi-word name (`Google Sheets` -> `GS`), one otherwise,
 * because `GO` for Google and `GO` for Gorgias would be worse than `G` twice.
 */
export function bubbleInitials(name: string): string {
  const words = name.split(/[\s.\-/]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0]?.slice(0, 1) ?? '?').toUpperCase()
}
