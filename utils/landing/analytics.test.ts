import { describe, expect, it } from 'vitest'
import { CONSENT_REQUIRED_REGIONS, consentDefaults, gtmSrc, shouldLoadTags } from './analytics'

describe('landing analytics', () => {
  it('denies analytics storage where consent is required, and grants it elsewhere', () => {
    const [regional, rest] = consentDefaults()
    expect(regional.region).toEqual([...CONSENT_REQUIRED_REGIONS])
    expect(regional.analytics_storage).toBe('denied')
    expect(rest.region).toBeUndefined()
    expect(rest.analytics_storage).toBe('granted')
  })

  it('never grants advertising storage or ad data anywhere', () => {
    for (const d of consentDefaults()) {
      expect([d.ad_storage, d.ad_user_data, d.ad_personalization]).toEqual(['denied', 'denied', 'denied'])
    }
  })

  it('covers all 27 EU states, the rest of the EEA, the UK and Switzerland', () => {
    expect(new Set(CONSENT_REQUIRED_REGIONS).size).toBe(32)
    for (const code of ['DE', 'FR', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH']) expect(CONSENT_REQUIRED_REGIONS).toContain(code)
  })

  it('loads only on a production host with a well-formed container id', () => {
    const hosts = ['iamjkc.space', 'www.iamjkc.space']
    expect(shouldLoadTags('iamjkc.space', 'GTM-KB5PL65K', hosts)).toBe(true)
    expect(shouldLoadTags('IAMJKC.SPACE', 'GTM-KB5PL65K', hosts)).toBe(true)
    expect(shouldLoadTags('localhost', 'GTM-KB5PL65K', hosts)).toBe(false)
    expect(shouldLoadTags('deploy-preview-12--iamprincejkc.netlify.app', 'GTM-KB5PL65K', hosts)).toBe(false)
    expect(shouldLoadTags('iamjkc.space', '', hosts)).toBe(false)
    expect(shouldLoadTags('iamjkc.space', 'G-ABC123', hosts)).toBe(false)
  })

  it('builds the standard container URL', () => {
    expect(gtmSrc('GTM-KB5PL65K')).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-KB5PL65K')
  })
})
