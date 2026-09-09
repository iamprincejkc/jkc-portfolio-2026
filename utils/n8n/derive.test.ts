import { describe, expect, it } from 'vitest'
import {
  buildDetail,
  deriveComplexity,
  deriveIntegrations,
  deriveName,
  deriveSummary,
  deriveTrigger,
  deriveWorkflow,
  flattenMarkdown,
  nameFromFilename,
} from './derive'
import type { WorkflowNote } from './types'

/** A node as it appears in a workflow file, with only the fields we read. */
function node(name: string, type: string, x = 0, y = 0, parameters?: Record<string, unknown>) {
  return { name, type, position: [x, y], parameters }
}

function sticky(content: string, x = 0, y = 0) {
  return node(`Sticky ${y}`, 'n8n-nodes-base.stickyNote', x, y, { content })
}

describe('nameFromFilename', () => {
  it('drops the index and the trailing trigger word', () => {
    expect(nameFromFilename('0001_Telegram_Schedule_Automation_Scheduled.json')).toBe('Telegram Schedule Automation')
    expect(nameFromFilename('0005_Manual_Twitter_Create_Triggered.json')).toBe('Manual Twitter Create')
  })

  it('unpacks the run-together node names the filenames are built from', () => {
    expect(nameFromFilename('0871_Splitout_Stickynote_Automate.json')).toBe('Split Out Sticky Note Automate')
    expect(nameFromFilename('1188_GoogleSheets_Emailreadimap_Create.json')).toBe('Google Sheets Email Create')
  })

  it('keeps a name that is nothing but the trigger word', () => {
    expect(nameFromFilename('0009_Process.json')).toBe('Process')
    expect(nameFromFilename('1234_Webhook.json')).toBe('Webhook')
  })
})

describe('deriveName', () => {
  it('prefers the workflow’s own name when it says something', () => {
    expect(deriveName({ name: 'Summarize emails with AI' }, '0100_Gmail_Automate.json')).toBe(
      'Summarize emails with AI',
    )
  })

  it('rejects the names that mean “untitled”', () => {
    const file = '0100_Gmail_Automate.json'
    for (const name of ['', '   ', 'My workflow', 'My workflow 6', 'Workflow 2', 'Production Workflow']) {
      expect(deriveName({ name }, file)).toBe('Gmail Automate')
    }
  })

  it('rejects a name that is only the filename spelled differently', () => {
    expect(deriveName({ name: 'Gmail_Automate' }, '0100_Gmail_Automate.json')).toBe('Gmail Automate')
  })
})

describe('deriveTrigger', () => {
  it('takes the most specific trigger, not the first one', () => {
    // 771 workflows keep a manual trigger their author used for testing.
    const nodes = [
      { type: 'n8n-nodes-base.manualTrigger' },
      { type: 'n8n-nodes-base.webhook' },
      { type: 'n8n-nodes-base.slack' },
    ]
    expect(deriveTrigger(nodes)).toBe('Webhook')
  })

  it('names each trigger family', () => {
    expect(deriveTrigger([{ type: 'n8n-nodes-base.scheduleTrigger' }])).toBe('Scheduled')
    expect(deriveTrigger([{ type: 'n8n-nodes-base.cron' }])).toBe('Scheduled')
    expect(deriveTrigger([{ type: '@n8n/n8n-nodes-langchain.chatTrigger' }])).toBe('Chat')
    expect(deriveTrigger([{ type: 'n8n-nodes-base.formTrigger' }])).toBe('Form')
    expect(deriveTrigger([{ type: 'n8n-nodes-base.executeWorkflowTrigger' }])).toBe('Sub-workflow')
    expect(deriveTrigger([{ type: 'n8n-nodes-base.telegramTrigger' }])).toBe('App event')
  })

  it('falls back to Manual when nothing starts the workflow', () => {
    expect(deriveTrigger([{ type: 'n8n-nodes-base.set' }])).toBe('Manual')
  })
})

describe('deriveIntegrations', () => {
  it('orders by how much of the workflow each service is', () => {
    const nodes = [
      { type: 'n8n-nodes-base.slack' },
      { type: 'n8n-nodes-base.googleSheets' },
      { type: 'n8n-nodes-base.googleSheets' },
      { type: 'n8n-nodes-base.if' },
    ]
    expect(deriveIntegrations(nodes)).toEqual(['Google Sheets', 'Slack'])
  })

  it('counts one service once however it is spelled', () => {
    const nodes = [
      { type: 'n8n-nodes-base.telegramTrigger' },
      { type: 'n8n-nodes-base.telegram' },
    ]
    expect(deriveIntegrations(nodes)).toEqual(['Telegram'])
  })
})

describe('deriveComplexity', () => {
  it('bands on step count', () => {
    expect(deriveComplexity(1)).toBe('Simple')
    expect(deriveComplexity(5)).toBe('Simple')
    expect(deriveComplexity(6)).toBe('Standard')
    expect(deriveComplexity(15)).toBe('Standard')
    expect(deriveComplexity(16)).toBe('Advanced')
  })
})

describe('flattenMarkdown', () => {
  it('takes the markdown off without eating the words', () => {
    const source = '## Add AI labels\n\nSets **labels** on your `Gmail` messages.\n\n- one\n- two\n[docs](https://x.dev)'
    expect(flattenMarkdown(source)).toBe('Add AI labels Sets labels on your Gmail messages. one two docs')
  })

  it('drops fenced code and images entirely', () => {
    expect(flattenMarkdown('Before\n```js\nconst x = 1\n```\nAfter')).toBe('Before After')
    expect(flattenMarkdown('![shot](a.png) Text')).toBe('Text')
  })
})

describe('deriveSummary', () => {
  const notes = (...contents: string[]): WorkflowNote[] =>
    contents.map((content, i) => ({ content, x: 0, y: i * 100, width: 240, height: 160 }))

  it('uses the first sticky note that reads like prose', () => {
    const summary = deriveSummary(
      notes('Set your key here', 'This workflow watches a Gmail inbox and files each message under a label.'),
      'Manual',
      [],
      4,
    )
    expect(summary).toBe('This workflow watches a Gmail inbox and files each message under a label.')
  })

  it('reads the canvas top-down, not the file order', () => {
    const unordered: WorkflowNote[] = [
      { content: 'The second note, which is long enough to be considered prose.', x: 0, y: 400, width: 1, height: 1 },
      { content: 'The first note, which is also long enough to be considered prose.', x: 0, y: 0, width: 1, height: 1 },
    ]
    expect(deriveSummary(unordered, 'Manual', [], 4)).toMatch(/^The first note/)
  })

  it('describes the workflow itself when there is nothing to quote', () => {
    expect(deriveSummary([], 'Scheduled', ['Slack', 'Notion'], 7)).toBe(
      'Runs on a schedule, connecting Slack and Notion. 7 steps.',
    )
    expect(deriveSummary([], 'Manual', [], 1)).toBe('Runs when you start it by hand. 1 step.')
  })

  it('never returns an empty string', () => {
    expect(deriveSummary(notes('short'), 'Webhook', [], 3).length).toBeGreaterThan(0)
  })
})

describe('buildDetail', () => {
  const workflow = {
    name: 'Demo',
    nodes: [
      node('When clicking Test', 'n8n-nodes-base.manualTrigger', 0, 0),
      node('Fetch', 'n8n-nodes-base.httpRequest', 200, 0),
      node('Model', '@n8n/n8n-nodes-langchain.lmChatOpenAi', 200, 300),
      node('Agent', '@n8n/n8n-nodes-langchain.agent', 400, 0),
      sticky('## How this works\n\nIt fetches, then thinks.', -40, -200),
      node('Placed but unwired', 'n8n-nodes-base.noOp', 600, 400),
    ],
    connections: {
      'When clicking Test': { main: [[{ node: 'Fetch', type: 'main', index: 0 }]] },
      Fetch: { main: [[{ node: 'Agent', type: 'main', index: 0 }]] },
      Model: { ai_languageModel: [[{ node: 'Agent', type: 'ai_languageModel', index: 0 }]] },
      Ghost: { main: [[{ node: 'Agent', type: 'main', index: 0 }]] },
      Agent: { main: [[{ node: 'Also a ghost', type: 'main', index: 0 }]] },
    },
  }

  it('keeps sticky notes out of the node list', () => {
    const detail = buildDetail(workflow)
    expect(detail.nodes.map((n) => n.name)).toEqual([
      'When clicking Test',
      'Fetch',
      'Model',
      'Agent',
      'Placed but unwired',
    ])
    expect(detail.notes).toHaveLength(1)
    expect(detail.notes[0].content).toContain('How this works')
  })

  it('resolves connections to node indices and keeps the channel', () => {
    const { edges } = buildDetail(workflow)
    expect(edges).toEqual([
      { from: 0, to: 1, channel: 'main' },
      { from: 1, to: 3, channel: 'main' },
      { from: 2, to: 3, channel: 'ai_languageModel' },
    ])
  })

  it('drops edges whose endpoints are not in the file', () => {
    // Both directions: an unknown source key and an unknown target node.
    const { edges } = buildDetail(workflow)
    expect(edges.some((e) => e.to === undefined || e.from === undefined)).toBe(false)
    expect(edges).toHaveLength(3)
  })

  it('carries the label and kind the diagram colours by', () => {
    const { nodes } = buildDetail(workflow)
    expect(nodes[0].kind).toBe('trigger')
    expect(nodes[1].label).toBe('HTTP Request')
    expect(nodes[2].kind).toBe('ai')
    expect(nodes[3].label).toBe('AI Agent')
  })

  it('survives a workflow with no connections at all', () => {
    expect(buildDetail({ nodes: [node('Only', 'n8n-nodes-base.set')] }).edges).toEqual([])
    expect(buildDetail({ nodes: [], connections: null }).nodes).toEqual([])
  })
})

describe('deriveWorkflow', () => {
  const source = JSON.stringify({
    name: 'My workflow',
    nodes: [
      node('Cron', 'n8n-nodes-base.scheduleTrigger', 0, 0),
      node('Sheet', 'n8n-nodes-base.googleSheets', 200, 0),
      sticky('Pulls yesterday’s rows out of the sheet and mails a digest to the team.', 0, -200),
    ],
    connections: { Cron: { main: [[{ node: 'Sheet', type: 'main', index: 0 }]] } },
  })

  it('builds the catalog row', () => {
    const derived = deriveWorkflow('0042_GoogleSheets_Schedule_Automate_Scheduled.json', 'Data', source)
    expect(derived?.entry).toMatchObject({
      id: '0042_GoogleSheets_Schedule_Automate_Scheduled',
      category: 'Data',
      name: 'Google Sheets Schedule Automate',
      trigger: 'Scheduled',
      complexity: 'Simple',
      steps: 2,
      integrations: ['Google Sheets'],
    })
    expect(derived?.entry.summary).toMatch(/^Pulls yesterday/)
  })

  it('returns the workflow untouched, for import', () => {
    const derived = deriveWorkflow('0042_X.json', 'Data', source)
    expect(derived?.workflow).toEqual(JSON.parse(source))
  })

  it('refuses anything it cannot publish honestly', () => {
    expect(deriveWorkflow('a.json', 'C', 'not json')).toBeNull()
    expect(deriveWorkflow('a.json', 'C', '{"name":"x"}')).toBeNull()
    // Ten files in the corpus are mangled into this shape - keys with quotes.
    expect(deriveWorkflow('a.json', 'C', '{"\\"nodes\\"": "["}')).toBeNull()
    // Sticky notes only: nothing to draw and nothing to run.
    expect(deriveWorkflow('a.json', 'C', JSON.stringify({ nodes: [sticky('hi')] }))).toBeNull()
  })
})
