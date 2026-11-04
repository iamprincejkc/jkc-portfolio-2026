import { describe, expect, it } from 'vitest'
import { CAKE_FLAME_TOP_Y, CAKE_PLATE_Y, CAKE_VIEWBOX, monthsaryLayout, needsRelayout } from './layout'

const VIEWPORTS = [
  ['phone', 375, 812],
  ['small phone', 320, 568],
  ['phone, landscape', 812, 375],
  ['tablet', 768, 1024],
  ['laptop', 1440, 900],
  ['desktop', 2560, 1440],
] as const

describe('monthsaryLayout', () => {
  it.each(VIEWPORTS)('keeps the words and the cake apart on a %s', (_, width, height) => {
    const layout = monthsaryLayout(width, height)
    const unit = layout.cake.width / CAKE_VIEWBOX.width
    const flameTop = layout.cake.y + CAKE_FLAME_TOP_Y * unit
    const plate = layout.cake.y + CAKE_PLATE_Y * unit

    expect(layout.text.y + layout.text.height).toBeLessThanOrEqual(flameTop)
    expect(plate).toBeLessThan(height)
    expect(layout.cake.x).toBeGreaterThanOrEqual(0)
    expect(layout.cake.x + layout.cake.width).toBeLessThanOrEqual(width)
    expect(layout.text.x).toBeGreaterThanOrEqual(16)
    expect(layout.text.x + layout.text.width).toBeLessThanOrEqual(width - 16)
    // Fireworks burst above the flame, never on the cake.
    expect(layout.sky.top).toBeLessThan(layout.sky.bottom)
    expect(layout.sky.bottom).toBeLessThan(flameTop)
  })

  it('breaks the words over three lines on a portrait screen and two on a wide one', () => {
    expect(monthsaryLayout(375, 812).lines).toEqual(['Happy', 'Monthsary', 'Langga'])
    expect(monthsaryLayout(1440, 900).lines).toEqual(['Happy Monthsary', 'Langga'])
  })

  it('builds a phone\'s words from at least as many tiles as a laptop\'s, relative to its size', () => {
    // Phone letters are the smallest, so they need the finest grid to stay legible.
    const phone = monthsaryLayout(390, 844)
    const laptop = monthsaryLayout(1440, 900)
    expect(phone.tiles / phone.text.width).toBeGreaterThan(laptop.tiles / laptop.text.width)
    expect(phone.tiles).toBeGreaterThanOrEqual(1000)
  })
})

describe('needsRelayout', () => {
  const phone = monthsaryLayout(390, 844)

  it('ignores the address bar sliding in and out', () => {
    expect(needsRelayout(phone, 390, 760)).toBe(false)
  })

  it('lays out again after a rotation', () => {
    expect(needsRelayout(phone, 844, 390)).toBe(true)
  })
})
