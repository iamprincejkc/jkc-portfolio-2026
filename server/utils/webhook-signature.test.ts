import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyWebhookSignature } from './webhook-signature'

const SECRET = 'a-test-webhook-secret'
const BODY = JSON.stringify({ form_name: 'contact', data: { name: 'Ada' } })

function b64url(value: string | object): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString(
    'base64url',
  )
}

/** Build a JWS the way Netlify does. */
function sign(claims: object, secret = SECRET): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url(claims)
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

const hashOf = (body: string) => createHash('sha256').update(body).digest('hex')

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed request', () => {
    expect(verifyWebhookSignature(sign({ sha256: hashOf(BODY) }), SECRET, BODY)).toBe(true)
  })

  it('rejects a token signed with a different secret', () => {
    const token = sign({ sha256: hashOf(BODY) }, 'not-the-secret')
    expect(verifyWebhookSignature(token, SECRET, BODY)).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const token = sign({ sha256: hashOf(BODY) })
    expect(verifyWebhookSignature(`${token.slice(0, -3)}AAA`, SECRET, BODY)).toBe(false)
  })

  it('rejects replay against different content', () => {
    // A token that was valid for BODY must not authorise a different body -
    // this is the check that the body hash in the claims exists for.
    const token = sign({ sha256: hashOf(BODY) })
    const tampered = JSON.stringify({ form_name: 'contact', data: { name: 'Mallory' } })
    expect(verifyWebhookSignature(token, SECRET, tampered)).toBe(false)
  })

  it('rejects a payload whose claims carry no hash', () => {
    expect(verifyWebhookSignature(sign({ nothing: true }), SECRET, BODY)).toBe(false)
  })

  it('rejects a non-hex hash claim rather than throwing', () => {
    expect(verifyWebhookSignature(sign({ sha256: 'not-hex' }), SECRET, BODY)).toBe(false)
    expect(verifyWebhookSignature(sign({ sha256: 123 }), SECRET, BODY)).toBe(false)
  })

  it('rejects a hash of the wrong length', () => {
    expect(verifyWebhookSignature(sign({ sha256: 'ab'.repeat(8) }), SECRET, BODY)).toBe(false)
  })

  it.each([undefined, null, '', 'garbage', 'only.two', 'a.b.c.d'])(
    'rejects malformed token: %s',
    (token) => {
      expect(verifyWebhookSignature(token as string | undefined, SECRET, BODY)).toBe(false)
    },
  )

  it('refuses to verify when no secret is configured', () => {
    // Fail closed: an empty secret must never authorise anything.
    const token = sign({ sha256: hashOf(BODY) }, '')
    expect(verifyWebhookSignature(token, '', BODY)).toBe(false)
  })
})
