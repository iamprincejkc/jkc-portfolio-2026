import data from './cake.json'

/**
 * The cake's layers, from Marco Barría's "new cake" on CodePen (MIT; see
 * THIRD-PARTY-NOTICES.md).
 *
 * `cake.json` is the pen's path data verbatim, whitespace aside: each layer is
 * one SVG path that morphs from a flat bar above the frame, through a squash on
 * impact, to its resting shape. Each animation starts when the one below it
 * ends, so the whole build is one chain; here the first link waits to be
 * started instead of firing two seconds after page load.
 */

/** When things happen, in seconds after the build starts. The SMIL chain itself runs 4.6 s. */
export const CAKE_TIMING = { candle: 4, flame: 4.5, built: 5 } as const

/**
 * Strawberry sponge and raspberry jam in place of the original's chocolate,
 * to sit with the page's pinks. Delete an entry to put its colour back.
 */
const PALETTE: Record<string, string> = {
  '#a88679': '#f4b9c6',
  '#8b6a60': '#c0466f',
  '#fefae9': '#fff7f1',
}

/** Prefixed so the pen's Spanish ids cannot collide with anything else on the page. */
const id = (name: string) => `ms_${name}`

export type CakeLayer = {
  id: string
  fill: string
  /** Before the build, and with reduced motion, the path is drawn at one end of its morph. */
  start: string
  final: string
  values: string
  keySplines: string
  dur: string
  begin: string
}

export const CAKE_LAYERS: CakeLayer[] = data.layers.map((layer) => ({
  id: id(layer.id),
  fill: PALETTE[layer.fill] ?? layer.fill,
  start: layer.values[0],
  final: layer.values[layer.values.length - 1],
  values: layer.values.join(';'),
  keySplines: layer.keySplines,
  dur: layer.dur,
  begin: layer.begin.endsWith('.end') ? `${id(layer.begin.slice(0, -'.end'.length))}.end` : 'indefinite',
}))

/** The link that starts the chain. */
export const CAKE_FIRST = CAKE_LAYERS.find((layer) => layer.begin === 'indefinite')!.id

export const CAKE_PLATE = { ...data.plate, fill: PALETTE[data.plate.fill] ?? data.plate.fill }
