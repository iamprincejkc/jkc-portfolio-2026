import { describe, expect, it } from 'vitest'
import { integrationOf, isTriggerType, kindOf, labelOf } from './nodes'

describe('integrationOf', () => {
  it('reads a service off a base node', () => {
    expect(integrationOf('n8n-nodes-base.googleSheets')).toBe('Google Sheets')
    expect(integrationOf('n8n-nodes-base.openWeatherMap')).toBe('Open Weather Map')
  })

  it('folds every spelling of one service onto the same name', () => {
    const spellings = [
      'n8n-nodes-base.googleSheets',
      'n8n-nodes-base.googleSheetsTrigger',
      'n8n-nodes-base.googleSheetsTool',
    ]
    expect(new Set(spellings.map(integrationOf))).toEqual(new Set(['Google Sheets']))
  })

  it('sees through the langchain role prefixes to the vendor', () => {
    expect(integrationOf('@n8n/n8n-nodes-langchain.lmChatOpenAi')).toBe('OpenAI')
    expect(integrationOf('@n8n/n8n-nodes-langchain.embeddingsOpenAi')).toBe('OpenAI')
    expect(integrationOf('@n8n/n8n-nodes-langchain.lmChatGoogleGemini')).toBe('Google Gemini')
    expect(integrationOf('@n8n/n8n-nodes-langchain.vectorStoreQdrant')).toBe('Qdrant')
    // memoryPostgresChat keeps a trailing Chat that has to come off too.
    expect(integrationOf('@n8n/n8n-nodes-langchain.memoryPostgresChat')).toBe('PostgreSQL')
  })

  it('does not call n8n’s own machinery an integration', () => {
    const core = [
      'n8n-nodes-base.if',
      'n8n-nodes-base.set',
      'n8n-nodes-base.stickyNote',
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.editImage',
      'n8n-nodes-base.executeWorkflowTrigger',
      '@n8n/n8n-nodes-langchain.agent',
      '@n8n/n8n-nodes-langchain.toolCalculator',
      '@n8n/n8n-nodes-langchain.toolWorkflow',
      '@n8n/n8n-nodes-langchain.chainLlm',
      '@n8n/n8n-nodes-langchain.outputParserStructured',
      '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      '@n8n/n8n-nodes-langchain.retrieverVectorStore',
    ]
    for (const type of core) expect([type, integrationOf(type)]).toEqual([type, null])
  })

  it('still names a community node it has never seen', () => {
    expect(integrationOf('n8n-nodes-klicktipp.klicktipp')).toBe('KlickTipp')
    expect(integrationOf('n8n-nodes-base.someNewService')).toBe('Some New Service')
  })
})

describe('labelOf', () => {
  it('keeps the part of the name that affix stripping threw away', () => {
    expect(labelOf('@n8n/n8n-nodes-langchain.chainLlm')).toBe('LLM Chain')
    expect(labelOf('@n8n/n8n-nodes-langchain.agent')).toBe('AI Agent')
  })

  it('uses the name n8n’s own canvas shows', () => {
    expect(labelOf('n8n-nodes-base.splitInBatches')).toBe('Loop Over Items')
    expect(labelOf('n8n-nodes-base.set')).toBe('Edit Fields')
    expect(labelOf('n8n-nodes-base.httpRequest')).toBe('HTTP Request')
  })

  it('labels a service node with the service', () => {
    expect(labelOf('n8n-nodes-base.telegramTrigger')).toBe('Telegram')
  })
})

describe('isTriggerType', () => {
  it('catches both the Trigger suffix and the ones without it', () => {
    expect(isTriggerType('n8n-nodes-base.scheduleTrigger')).toBe(true)
    expect(isTriggerType('n8n-nodes-base.webhook')).toBe(true)
    expect(isTriggerType('n8n-nodes-base.cron')).toBe(true)
    expect(isTriggerType('@n8n/n8n-nodes-langchain.chatTrigger')).toBe(true)
  })

  it('does not mistake a mid-flow node for a trigger', () => {
    expect(isTriggerType('n8n-nodes-base.respondToWebhook')).toBe(false)
    expect(isTriggerType('n8n-nodes-base.set')).toBe(false)
  })
})

describe('kindOf', () => {
  it('sorts nodes into the colours the diagram uses', () => {
    expect(kindOf('n8n-nodes-base.webhook')).toBe('trigger')
    expect(kindOf('@n8n/n8n-nodes-langchain.agent')).toBe('ai')
    expect(kindOf('n8n-nodes-base.openAi')).toBe('ai')
    expect(kindOf('n8n-nodes-base.if')).toBe('logic')
    expect(kindOf('n8n-nodes-base.code')).toBe('data')
    expect(kindOf('n8n-nodes-base.respondToWebhook')).toBe('output')
    expect(kindOf('n8n-nodes-base.slack')).toBe('app')
  })

  it('calls a trigger a trigger even when it is also an app', () => {
    expect(kindOf('n8n-nodes-base.telegramTrigger')).toBe('trigger')
  })
})
