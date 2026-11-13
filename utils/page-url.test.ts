import { describe, expect, it } from 'vitest'
import { pagePath, pageUrl } from './page-url'

describe('page URLs', () => {
  it('adds the trailing slash Netlify serves prerendered pages under', () => {
    expect(pagePath('/about')).toBe('/about/')
    expect(pagePath('/about/')).toBe('/about/')
    expect(pagePath('/n8n')).toBe('/n8n/')
  })

  it('leaves the home page as it is', () => {
    expect(pagePath('/')).toBe('/')
    expect(pagePath('')).toBe('/')
  })

  it('drops a query or fragment', () => {
    expect(pagePath('/qr-generator?url=x')).toBe('/qr-generator/')
    expect(pagePath('/me#work')).toBe('/me/')
  })

  it('joins onto the site URL with or without its own slash', () => {
    expect(pageUrl('https://iamjkc.space', '/me')).toBe('https://iamjkc.space/me/')
    expect(pageUrl('https://iamjkc.space/', '/')).toBe('https://iamjkc.space/')
  })
})
