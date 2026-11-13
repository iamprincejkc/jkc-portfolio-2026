import { describe, expect, it } from 'vitest'
import { skipsMotion } from './motion'

describe('skipsMotion', () => {
  it('skips the scroll-motion stack on the business landing page', () => {
    expect(skipsMotion('/')).toBe(true)
    expect(skipsMotion('/index.html')).toBe(true)
  })

  it('keeps it on the portfolio pages that animate', () => {
    for (const path of ['/me', '/about', '/n8n', '/public-api', '/qr-generator', '/gallery']) {
      expect(skipsMotion(path)).toBe(false)
    }
  })
})
