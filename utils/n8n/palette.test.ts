import { describe, expect, it } from 'vitest'
import { bubbleColour, bubbleInitials, KIND_COLOURS } from './palette'

describe('bubbleColour', () => {
  it('gives one service the same colour every time', () => {
    expect(bubbleColour('Slack')).toBe(bubbleColour('Slack'))
    expect(bubbleColour('Google Sheets')).not.toBe(bubbleColour('Slack'))
  })

  it('always returns a colour, including for an empty name', () => {
    expect(bubbleColour('')).toMatch(/^#[0-9a-f]{6}$/)
    expect(bubbleColour('a'.repeat(500))).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('spreads the common services across the palette', () => {
    const services = ['OpenAI', 'Google Sheets', 'Gmail', 'Telegram', 'Google Drive', 'Slack', 'Airtable']
    expect(new Set(services.map(bubbleColour)).size).toBeGreaterThanOrEqual(5)
  })
})

describe('bubbleInitials', () => {
  it('uses two letters when the name has two words', () => {
    expect(bubbleInitials('Google Sheets')).toBe('GS')
    expect(bubbleInitials('Monday.com')).toBe('MC')
    expect(bubbleInitials('Twitter/X')).toBe('TX')
  })

  it('uses one letter for a single word', () => {
    expect(bubbleInitials('Slack')).toBe('S')
    expect(bubbleInitials('n8n')).toBe('N')
  })

  it('does not fall over on an empty name', () => {
    expect(bubbleInitials('')).toBe('?')
  })
})

describe('KIND_COLOURS', () => {
  it('covers every node kind', () => {
    expect(Object.keys(KIND_COLOURS).sort()).toEqual(['ai', 'app', 'data', 'logic', 'output', 'trigger'])
  })
})
