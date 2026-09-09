/**
 * Deriving a catalog entry and a diagram from one raw n8n workflow.
 *
 * This runs at build time (`scripts/build-n8n-catalog.mjs`), never in the
 * browser, but it lives in `utils/` and stays a pure function so it can be
 * unit-tested the same way the QR engine is. Everything it needs arrives as an
 * argument; nothing it does touches a filesystem or a network.
 *
 * The corpus it has to survive is genuinely messy. Half the workflows carry no
 * `name` at all, a good number call themselves "My workflow", and the
 * documentation - where there is any - is not in a description field but
 * written on sticky notes pinned to the canvas. So every field here has a
 * derivation and a fallback, and no field is allowed to come out empty.
 */
import { integrationOf, isTriggerType, kindOf, labelOf, localType } from './nodes.ts'
import { redactWorkflow } from './redact.ts'
import type {
  CatalogEntry,
  Complexity,
  Trigger,
  WorkflowDetail,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNote,
} from './types.ts'

const STICKY = 'n8n-nodes-base.stickyNote'

/** The raw shape, as loosely as it actually arrives. */
export interface RawWorkflow {
  name?: unknown
  nodes?: unknown
  connections?: unknown
}

interface RawNode {
  name?: unknown
  type?: unknown
  position?: unknown
  disabled?: unknown
  parameters?: Record<string, unknown>
}

/**
 * Trigger types, most specific first. A workflow that has both a webhook and a
 * manual trigger is a webhook workflow; the manual trigger is just how its
 * author tested it, and 771 of the 2,055 workflows carry one.
 */
const TRIGGER_PRIORITY: Trigger[] = ['Webhook', 'Scheduled', 'Chat', 'Form', 'App event', 'Sub-workflow', 'Manual']

/** Words a filename ends with that describe the trigger, not the workflow. */
const FILENAME_SUFFIXES = new Set(['scheduled', 'triggered', 'webhook', 'manual'])

/**
 * Filename words that title-casing alone gets wrong.
 *
 * The filenames are node type names run together and stripped of their
 * capitals, so `0871_Splitout_Stickynote_Automate.json` needs a table to come
 * back out as words. Only the tokens that actually recur are listed - the tail
 * is title-cased and left alone, which is right far more often than it is
 * wrong.
 */
const FILENAME_WORDS: Record<string, string> = {
  // Acronyms.
  api: 'API', http: 'HTTP', ai: 'AI', url: 'URL', pdf: 'PDF', csv: 'CSV',
  html: 'HTML', json: 'JSON', sql: 'SQL', rss: 'RSS', sms: 'SMS', crm: 'CRM',
  seo: 'SEO', gpt: 'GPT', llm: 'LLM', rag: 'RAG', ocr: 'OCR', qr: 'QR',
  aws: 'AWS', s3: 'S3', ftp: 'FTP', ssh: 'SSH', xml: 'XML', id: 'ID',
  // Brands.
  openai: 'OpenAI', github: 'GitHub', gitlab: 'GitLab', linkedin: 'LinkedIn',
  youtube: 'YouTube', whatsapp: 'WhatsApp', tiktok: 'TikTok', paypal: 'PayPal',
  hubspot: 'HubSpot', wordpress: 'WordPress', mysql: 'MySQL', mongodb: 'MongoDB',
  postgres: 'Postgres', nocodb: 'NocoDB', clickup: 'ClickUp', n8n: 'n8n',
  mondaycom: 'Monday.com', openweathermap: 'OpenWeatherMap',
  activecampaign: 'ActiveCampaign', convertkit: 'ConvertKit',
  googlesheets: 'Google Sheets', googledrive: 'Google Drive',
  googlecalendar: 'Google Calendar', googledocs: 'Google Docs',
  googlecalendartool: 'Google Calendar', googleanalytics: 'Google Analytics',
  googletasks: 'Google Tasks', microsoftoutlook: 'Outlook',
  microsoftteams: 'Microsoft Teams', emailreadimap: 'Email',
  emailsend: 'Email', rssfeedread: 'RSS',
  // Core node names, which are what most of these filenames are made of.
  splitout: 'Split Out', splitinbatches: 'Loop', stickynote: 'Sticky Note',
  respondtowebhook: 'Webhook Response', extractfromfile: 'Extract from File',
  converttofile: 'Convert to File', executeworkflow: 'Execute Workflow',
  executecommand: 'Execute Command', stopanderror: 'Stop and Error',
  functionitem: 'Function Item', readbinaryfile: 'Read File',
  writebinaryfile: 'Write File', readwritefile: 'Read/Write File',
  movebinarydata: 'Move Binary Data', spreadsheetfile: 'Spreadsheet File',
  removeduplicates: 'Remove Duplicates', comparedatasets: 'Compare Datasets',
  htmlextract: 'HTML Extract', editimage: 'Edit Image', datetime: 'Date & Time',
  noop: 'No Op', itemlists: 'Item Lists', renamekeys: 'Rename Keys',
  executiondata: 'Execution Data', httprequest: 'HTTP Request',
}

/**
 * Names that are a label for "we could not think of one". Anything matching is
 * discarded in favour of the filename, which at least says what the workflow
 * touches.
 */
function isPlaceholderName(name: string): boolean {
  if (!name) return true
  if (/^my workflow/i.test(name)) return true
  if (/^workflow(\s*\d+)?$/i.test(name)) return true
  // The upstream repo's own auto-namer: "<Nodetype> Workflow".
  if (/^\w+ workflow$/i.test(name)) return true
  if (/^(production|test|demo|template|untitled|copy of)\b/i.test(name)) return true
  return false
}

/**
 * `0001_Telegram_Schedule_Automation_Scheduled.json` -> `Telegram Schedule
 * Automation`. The leading number is an index and the trailing word repeats the
 * trigger, which the card already shows as a chip.
 */
export function nameFromFilename(filename: string): string {
  const stem = filename.replace(/\.json$/i, '')
  let parts = stem.split('_').filter(Boolean)

  if (parts.length > 1 && /^\d+$/.test(parts[0])) parts = parts.slice(1)
  if (parts.length > 1 && FILENAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    parts = parts.slice(0, -1)
  }
  if (parts.length === 0) return stem

  return parts
    .map((part) => FILENAME_WORDS[part.toLowerCase()] ?? part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Prefers the workflow's own name, but only when it is worth reading. */
export function deriveName(raw: RawWorkflow, filename: string): string {
  const own = typeof raw.name === 'string' ? raw.name.trim() : ''
  const fromFile = nameFromFilename(filename)
  if (!own || isPlaceholderName(own)) return fromFile
  // A "name" that is just the filename back again tells the reader nothing new.
  if (own.replace(/[\s_]+/g, '').toLowerCase() === fromFile.replace(/\s+/g, '').toLowerCase()) return fromFile
  return own
}

/** Which of n8n's trigger nodes this one is, or null if it is not a trigger. */
function triggerOf(type: string): Trigger | null {
  if (!isTriggerType(type)) return null

  const local = localType(type)
  if (/^webhook$/i.test(local) || /^sseTrigger$/i.test(local)) return 'Webhook'
  if (/^(scheduleTrigger|cron|interval)$/i.test(local)) return 'Scheduled'
  if (/chatTrigger$/i.test(local)) return 'Chat'
  if (/^formTrigger$/i.test(local)) return 'Form'
  if (/^manualTrigger$/i.test(local)) return 'Manual'
  if (/^executeWorkflowTrigger$/i.test(local) || /^workflowTrigger$/i.test(local)) return 'Sub-workflow'
  return 'App event'
}

/** The most specific trigger present, or Manual when there is none at all. */
export function deriveTrigger(nodes: { type: string }[]): Trigger {
  const found = new Set<Trigger>()
  for (const node of nodes) {
    const trigger = triggerOf(node.type)
    if (trigger) found.add(trigger)
  }
  return TRIGGER_PRIORITY.find((t) => found.has(t)) ?? 'Manual'
}

/**
 * Services this workflow talks to, most-used first so the two chips a card has
 * room for are the two that matter.
 */
export function deriveIntegrations(nodes: { type: string }[]): string[] {
  const counts = new Map<string, number>()
  for (const node of nodes) {
    const service = integrationOf(node.type)
    if (service) counts.set(service, (counts.get(service) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([service]) => service)
}

/** Size, from real steps rather than node count - sticky notes are not steps. */
export function deriveComplexity(steps: number): Complexity {
  if (steps <= 5) return 'Simple'
  if (steps <= 15) return 'Standard'
  return 'Advanced'
}

/**
 * A one-line summary.
 *
 * The workflows carry no description field worth reading, but 1,323 of them
 * have sticky notes, and the first note on the canvas is nearly always the
 * author explaining what the thing does. So the summary is that note with its
 * markdown taken off - real prose, written by the person who built it.
 *
 * Everything else falls back to a sentence assembled from what the workflow
 * demonstrably is, which is honest even when it is dull.
 */
export function deriveSummary(notes: WorkflowNote[], trigger: Trigger, integrations: string[], steps: number): string {
  return summaryFromNotes(notes) || describeWorkflow(trigger, integrations, steps)
}

/**
 * The fallback summary: a sentence assembled from what the workflow
 * demonstrably is. Honest, and dull enough that it is worth knowing which
 * summaries are this and which are the author's own - see `documented`.
 */
export function describeWorkflow(trigger: Trigger, integrations: string[], steps: number): string {
  const services = integrations.slice(0, 3)
  const opening: Record<Trigger, string> = {
    Webhook: 'Runs when a webhook is called',
    Scheduled: 'Runs on a schedule',
    Chat: 'Runs from a chat message',
    Form: 'Runs when a form is submitted',
    'App event': 'Runs when an app event fires',
    'Sub-workflow': 'Runs when another workflow calls it',
    Manual: 'Runs when you start it by hand',
  }

  let sentence = opening[trigger]
  if (services.length === 1) sentence += `, working with ${services[0]}`
  else if (services.length > 1) {
    sentence += `, connecting ${services.slice(0, -1).join(', ')} and ${services[services.length - 1]}`
  }
  return `${sentence}. ${steps} step${steps === 1 ? '' : 's'}.`
}

/**
 * How much of a note a summary keeps.
 *
 * The card clamps its summary to three lines, which is about 120 characters
 * at the width a card ever gets, so anything past this was only ever being
 * cut off by CSS. Storing it anyway cost 273 kB of the catalog's 804 kB - a
 * third of the file, spent on text nobody could read.
 */
const SUMMARY_MAX = 160

/** The first sticky note that reads like prose, flattened to one line. */
export function summaryFromNotes(notes: WorkflowNote[]): string {
  // Canvas order, so the note the author put at the top-left wins.
  const ordered = [...notes].sort((a, b) => a.y - b.y || a.x - b.x)

  for (const note of ordered) {
    const text = flattenMarkdown(note.content)
    if (text.length < 40) continue
    return truncate(text, SUMMARY_MAX)
  }
  return ''
}

/**
 * Markdown to a single readable line.
 *
 * Only what actually appears in these notes: headings, emphasis, links, code
 * fences, images and list bullets. A markdown parser would be a dependency
 * earning its keep on nothing, since the output is one line of plain text.
 */
export function flattenMarkdown(markdown: string): string {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cuts at a word boundary and adds an ellipsis, or returns the text unharmed. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, '')}...`
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
}

/**
 * Splits the raw node list into diagram nodes and sticky notes, dropping
 * anything without a type - the only field everything downstream depends on.
 */
function readNodes(raw: RawWorkflow): { nodes: WorkflowNode[]; notes: WorkflowNote[] } {
  const list = Array.isArray(raw.nodes) ? (raw.nodes as RawNode[]) : []
  const nodes: WorkflowNode[] = []
  const notes: WorkflowNote[] = []

  for (const node of list) {
    if (!node || typeof node !== 'object') continue
    const type = typeof node.type === 'string' ? node.type : ''
    if (!type) continue

    const position = Array.isArray(node.position) ? node.position : []
    const x = toNumber(position[0])
    const y = toNumber(position[1])

    if (type === STICKY) {
      const content = String(node.parameters?.content ?? '')
      if (content.trim()) {
        notes.push({
          content,
          x,
          y,
          width: toNumber(node.parameters?.width, 240),
          height: toNumber(node.parameters?.height, 160),
        })
      }
      continue
    }

    const entry: WorkflowNode = {
      name: typeof node.name === 'string' && node.name ? node.name : labelOf(type),
      type,
      label: labelOf(type),
      kind: kindOf(type),
      x,
      y,
    }
    if (node.disabled === true) entry.disabled = true
    nodes.push(entry)
  }

  return { nodes, notes }
}

/**
 * Resolves n8n's connection map into index pairs.
 *
 * n8n keys `connections` by node *name*, and so does every link inside it.
 * Sticky notes never appear there, so an edge whose endpoint is missing from
 * the index is either a note (impossible) or a reference to a node that is not
 * in the file - both of which are dropped rather than drawn as a line into
 * nowhere.
 */
export function readEdges(raw: RawWorkflow, nodes: WorkflowNode[]): WorkflowEdge[] {
  const index = new Map<string, number>()
  nodes.forEach((node, i) => {
    if (!index.has(node.name)) index.set(node.name, i)
  })

  const connections = raw.connections
  if (!connections || typeof connections !== 'object') return []

  const edges: WorkflowEdge[] = []
  const seen = new Set<string>()

  for (const [source, channels] of Object.entries(connections as Record<string, unknown>)) {
    const from = index.get(source)
    if (from === undefined || !channels || typeof channels !== 'object') continue

    for (const [channel, outputs] of Object.entries(channels as Record<string, unknown>)) {
      if (!Array.isArray(outputs)) continue
      for (const output of outputs) {
        if (!Array.isArray(output)) continue
        for (const link of output) {
          const target = link && typeof link === 'object' ? (link as { node?: unknown }).node : null
          if (typeof target !== 'string') continue
          const to = index.get(target)
          if (to === undefined || to === from) continue

          const key = `${from}>${to}:${channel}`
          if (seen.has(key)) continue
          seen.add(key)
          edges.push({ from, to, channel })
        }
      }
    }
  }

  return edges
}

/**
 * The reading of a workflow that the diagram and the notes panel need.
 *
 * Runs in the browser, on the workflow file as fetched. It is the same
 * function the build used to write the catalog row, so what the panel draws
 * and what the card claims can never disagree.
 */
export function buildDetail(raw: RawWorkflow): WorkflowDetail {
  const { nodes, notes } = readNodes(raw)
  return { nodes, edges: readEdges(raw, nodes), notes }
}

/** A catalog row and the workflow it describes, ready to be written out. */
export interface Derived {
  entry: CatalogEntry
  /**
   * Written to `public/n8n/workflows/<id>.json`. Identical to the source
   * except that any credential its author left inline has been replaced -
   * see `redact.ts` for why that is not optional.
   */
  workflow: RawWorkflow
  /** Not written - the build reports node and edge totals from it. */
  detail: WorkflowDetail
  /** How many strings in this workflow held something that looked like a key. */
  redactions: number
}

/**
 * @param filename  Source filename, e.g. `0001_Telegram_Automation.json`.
 * @param category  From the corpus's own categorisation.
 * @param source    The file's text. Returns null if it will not parse, has no
 *                  node array, or turns out to be nothing but sticky notes.
 */
export function deriveWorkflow(filename: string, category: string, source: string): Derived | null {
  let parsed: RawWorkflow
  try {
    parsed = JSON.parse(source) as RawWorkflow
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes)) return null

  /*
   * Before anything else reads it. Everything downstream - the catalog row,
   * the diagram, the file written to `public/` - is derived from the redacted
   * copy, so there is no path by which the original value reaches disk.
   */
  const { workflow: raw, redactions } = redactWorkflow(parsed)

  const detail = buildDetail(raw)
  const { nodes, notes } = detail
  if (nodes.length === 0) return null

  const trigger = deriveTrigger(nodes)
  const integrations = deriveIntegrations(nodes)
  const authored = summaryFromNotes(notes)

  return {
    entry: {
      id: filename.replace(/\.json$/i, ''),
      name: deriveName(raw, filename),
      category,
      trigger,
      complexity: deriveComplexity(nodes.length),
      steps: nodes.length,
      integrations,
      summary: authored || describeWorkflow(trigger, integrations, nodes.length),
      ...(authored ? { documented: 1 as const } : {}),
      /*
       * Measured on the minified form, because that is the workflow itself
       * without whichever indentation its author's editor happened to use.
       */
      bytes: JSON.stringify(raw).length,
    },
    workflow: raw,
    detail,
    redactions,
  }
}
