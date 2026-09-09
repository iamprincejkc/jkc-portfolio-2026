import { describe, expect, it } from 'vitest'
import { hasSecret, REDACTED, redactString, redactWorkflow } from './redact'

/*
 * Every credential-shaped value below is assembled at runtime from pieces,
 * never written as a literal.
 *
 * That is not fussiness. A string that matches a credential pattern *is* a
 * credential as far as any scanner is concerned, and a test file is source
 * like any other: GitHub's push protection rejected this very file for a fake
 * Slack token, a fake Stripe key and a fake Mailgun key before they were
 * split up. Assembling them keeps the test honest about the shape without
 * putting a matchable string in a public repository.
 */
const filler = (length: number) => 'A1b2C3d4E5f6G7h8'.repeat(Math.ceil(length / 16)).slice(0, length)
const hex = (length: number) => '0123456789abcdef'.repeat(Math.ceil(length / 16)).slice(0, length)

const SAMPLES: [string, string][] = [
  ['OpenAI', `sk-${'proj-'}${filler(40)}`],
  ['Anthropic', `sk-${'ant-'}api03-${filler(40)}`],
  ['Perplexity', `pplx${'-'}${filler(40)}`],
  ['Apify', `apify${'_api_'}${filler(32)}`],
  ['Google', `AIza${filler(35)}`],
  ['AWS', `AKIA${'IOSFODNN7EXAMPLE'}`],
  ['Slack', `xox${'b-'}1234567890-${filler(16)}`],
  ['GitHub', `ghp${'_'}${filler(36)}`],
  ['Stripe', `sk${'_live_'}${filler(24)}`],
  ['SendGrid', `SG${'.'}${filler(22)}.${filler(43)}`],
  ['Hugging Face', `hf${'_'}${filler(34)}`],
  ['Telegram', `123456789:${'AA'}${filler(33)}`],
  ['Mailgun', `key${'-'}${hex(32)}`],
  ['JWT', `eyJ${filler(20)}.eyJ${filler(20)}.${filler(20)}`],
]

describe('redactString', () => {
  it.each(SAMPLES)('redacts a %s credential', (_label, secret) => {
    expect(redactString(`Bearer ${secret}`)).toBe(`Bearer ${REDACTED}`)
  })

  it('redacts a whole PEM block, not just its header', () => {
    const pem = `-----BEGIN RSA PRIVATE KEY-----\n${filler(40)}\n${filler(40)}\n-----END RSA PRIVATE KEY-----`
    const out = redactString(`key: ${pem}`)
    expect(out).toBe(`key: ${REDACTED}`)
    expect(out).not.toContain(filler(40))
  })

  it('redacts a webhook URL that carries its own token', () => {
    const url = `https://discord.com/api/webhooks/123456789012345678/${filler(28)}`
    expect(redactString(url)).toContain(REDACTED)
    expect(redactString(url)).not.toContain(filler(28))
  })

  it('takes the more specific vendor prefix first', () => {
    // The Anthropic shape must not be half-eaten by the more general sk- rule.
    expect(redactString(SAMPLES[1][1])).toBe(REDACTED)
  })

  /* ---- The other half: not mangling workflows ---- */

  it('leaves the things a workflow is actually made of alone', () => {
    const innocent = [
      'n8n-nodes-base.httpRequest',
      '2b4c1e91-c64b-43cb-aba2-c6f8f5a17c79',
      'https://api.example.com/v1/items?limit=50',
      '={{ $json.body.message }}',
      'e4f78845dfed9ddcfba1945ae00d12e9a7d76eab052afd19299228ce02349d86',
      'Sticky note explaining how to set your key',
      '',
    ]
    for (const value of innocent) {
      expect([value, redactString(value)]).toEqual([value, value])
      expect(hasSecret(value)).toBe(false)
    }
  })
})

describe('redactWorkflow', () => {
  const secret = `pplx${'-'}${filler(40)}`

  const workflow = {
    name: 'Demo',
    nodes: [
      {
        name: 'Call the API',
        parameters: {
          url: 'https://api.perplexity.ai/chat',
          headerParameters: {
            parameters: [{ name: 'Authorization', value: `Bearer ${secret}` }],
          },
        },
      },
      { name: 'Plain', parameters: { jsCode: 'return items' } },
    ],
    connections: { 'Call the API': { main: [[{ node: 'Plain', type: 'main', index: 0 }]] } },
  }

  it('redacts wherever the credential is nested, and counts it', () => {
    const { workflow: clean, redactions } = redactWorkflow(workflow)
    expect(redactions).toBe(1)
    expect(JSON.stringify(clean)).not.toContain(secret)
    expect(JSON.stringify(clean)).toContain(REDACTED)
  })

  it('keeps the workflow structurally identical, so it still imports', () => {
    const { workflow: clean } = redactWorkflow(workflow)
    expect(Object.keys(clean)).toEqual(Object.keys(workflow))
    expect(clean.nodes).toHaveLength(2)
    expect(clean.nodes[0].name).toBe('Call the API')
    // A key named `Authorization` keeps its name; only the value changes.
    expect(clean.nodes[0].parameters.headerParameters.parameters[0].name).toBe('Authorization')
    expect(clean.connections).toEqual(workflow.connections)
  })

  it('reports nothing for a workflow that was already clean', () => {
    const { redactions } = redactWorkflow({ nodes: [{ parameters: { jsCode: 'return 1' } }] })
    expect(redactions).toBe(0)
  })

  it('survives nulls, numbers and booleans', () => {
    const odd = { a: null, b: 4, c: true, d: [null, `sk-${'proj-'}${filler(40)}`] }
    const { workflow: clean, redactions } = redactWorkflow(odd)
    expect(redactions).toBe(1)
    expect(clean.a).toBeNull()
    expect(clean.b).toBe(4)
    expect(clean.c).toBe(true)
    expect(clean.d[1]).toBe(REDACTED)
  })
})
