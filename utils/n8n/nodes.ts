/**
 * Turning an n8n node type into something a human can read.
 *
 * The upstream corpus uses 495 distinct node types, so a hand-written table
 * was never going to cover it. What saves the day is that n8n's naming is
 * extremely regular:
 *
 *   n8n-nodes-base.googleSheets              a service
 *   n8n-nodes-base.googleSheetsTrigger       the same service, as a trigger
 *   n8n-nodes-base.googleSheetsTool          the same service, exposed to an agent
 *   @n8n/n8n-nodes-langchain.lmChatOpenAi    a service behind an AI-role prefix
 *   @n8n/n8n-nodes-langchain.toolCalculator  no service at all - AI plumbing
 *
 * So the pipeline is: drop the package, drop the role affixes, then ask two
 * small tables whether what remains is plumbing (`CORE`) or a brand whose
 * capitalisation we cannot guess (`BRANDS`). Anything left over is
 * de-camel-cased, which handles the long tail correctly - `nextCloud` becomes
 * `Next Cloud`, `openWeatherMap` becomes `Open Weather Map`.
 *
 * The alternative - enumerating every node type n8n has ever shipped - would
 * be wrong the day n8n shipped its next one.
 */
import type { NodeKind } from './types.ts'

/**
 * AI-role prefixes on `@n8n/n8n-nodes-langchain.*`. Longest first, because
 * `lmChat` must win over `lm`.
 */
const LANGCHAIN_PREFIXES = [
  'lmChat',
  'lm',
  'embeddings',
  'vectorStore',
  'retriever',
  'textSplitter',
  'outputParser',
  'document',
  'memory',
  'chain',
  'tool',
]

/**
 * Node types that are n8n's own machinery rather than a service you integrate
 * with. Entries are the *affix-stripped* form, which is why `toolWorkflow`,
 * `executeWorkflow` and `workflowTrigger` all collapse onto `workflow`.
 */
const CORE = new Set([
  'aggregate', 'autofixing', 'binaryInputLoader', 'bufferWindow', 'calculator',
  'characterTextSplitter', 'chat', 'code', 'compareDatasets', 'compression',
  'convertToFile', 'cron', 'crypto', 'dateTime', 'debugHelper',
  'defaultDataLoader', 'editImage', 'emailReadImap', 'emailSend',
  'error', 'errorWorkflow', 'executeCommand', 'executeWorkflow',
  'executionData', 'extractFromFile', 'filter', 'form', 'ftp', 'function',
  'functionItem', 'graphql', 'html', 'htmlExtract', 'httpRequest', 'if',
  'inMemory', 'informationExtractor', 'interval', 'itemList', 'itemLists',
  'limit', 'llm', 'loader', 'localFile', 'manager', 'manual', 'manualChat',
  'markdown', 'mcp', 'mcpClient', 'merge', 'moveBinaryData', 'n8n',
  'n8nTrainingCustomerDatastore', 'n8nTrainingCustomerMessenger', 'noOp',
  'readBinaryFile', 'readBinaryFiles',
  'readWriteFile', 'recursiveCharacterTextSplitter', 'removeDuplicates',
  'renameKeys', 'respondToWebhook', 'retrievalQa', 'schedule',
  'sentimentAnalysis', 'set', 'sort', 'splitInBatches', 'splitOut',
  'spreadsheetFile', 'sse', 'stickyNote', 'stopAndError', 'structured',
  'summarization', 'summarize', 'switch', 'textClassifier', 'tokenSplitter',
  'vectorStore', 'wait', 'webhook', 'workflow', 'writeBinaryFile', 'xml',
  'agent', 'ssh',
])

/**
 * Brands whose casing or spelling no algorithm recovers from camelCase.
 * Keyed by the affix-stripped type, lowercased.
 */
const BRANDS: Record<string, string> = {
  awss3: 'AWS S3', s3: 'AWS S3', awssns: 'AWS SNS', awsses: 'AWS SES',
  awsrekognition: 'AWS Rekognition', awstextract: 'AWS Textract',
  awstranscribe: 'AWS Transcribe', awslambda: 'AWS Lambda',
  awscomprehend: 'AWS Comprehend', awsdynamodb: 'AWS DynamoDB',
  openai: 'OpenAI', azureopenai: 'Azure OpenAI', openrouter: 'OpenRouter',
  mistralcloud: 'Mistral', googlegemini: 'Google Gemini', googlepalm: 'Google PaLM',
  googlevertex: 'Google Vertex AI', huggingface: 'Hugging Face',
  deepseek: 'DeepSeek', serpapi: 'SerpAPI', wolframalpha: 'Wolfram Alpha',
  postgres: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB',
  microsoftsql: 'Microsoft SQL', pgvector: 'PGVector', nocodb: 'NocoDB',
  youtube: 'YouTube', linkedin: 'LinkedIn', twitter: 'Twitter/X', x: 'Twitter/X',
  whatsapp: 'WhatsApp', tiktok: 'TikTok', github: 'GitHub', gitlab: 'GitLab',
  paypal: 'PayPal', quickbooks: 'QuickBooks', woocommerce: 'WooCommerce',
  wordpress: 'WordPress', hubspot: 'HubSpot', mondaycom: 'Monday.com',
  clickup: 'ClickUp', nextcloud: 'Nextcloud', onedrive: 'OneDrive',
  jotform: 'JotForm', klicktipp: 'KlickTipp', mailerlite: 'MailerLite',
  getresponse: 'GetResponse', activecampaign: 'ActiveCampaign',
  convertkit: 'ConvertKit', sendgrid: 'SendGrid', rabbitmq: 'RabbitMQ',
  mqtt: 'MQTT', amqp: 'AMQP', thehive: 'TheHive', thehiveproject: 'TheHive',
  pagerduty: 'PagerDuty', signl4: 'SIGNL4', uproc: 'uProc',
  bamboohr: 'BambooHR', helpscout: 'Help Scout', customerio: 'Customer.io',
  invoiceninja: 'Invoice Ninja', surveymonkey: 'SurveyMonkey', rssfeedread: 'RSS',
  microsoftoutlook: 'Outlook', microsoftteams: 'Microsoft Teams',
  microsoftexcel: 'Microsoft Excel', microsoftonedrive: 'OneDrive',
  facebookgraphapi: 'Facebook', facebookleadads: 'Facebook Lead Ads',
  googlecloudnaturallanguage: 'Google Natural Language',
  googlebigquery: 'Google BigQuery', googlefirebasecloudfirestore: 'Firestore',
  apitemplateio: 'APITemplate.io', calcom: 'Cal.com', cal: 'Cal.com',
  hackernews: 'Hacker News',
  // The long tail, where de-camel-casing splits an acronym or a product name.
  mongodbatlas: 'MongoDB Atlas', humanticai: 'Humantic AI', openaiassistant: 'OpenAI',
  sendinblue: 'Brevo', microsofttodo: 'Microsoft To Do', cratedb: 'CrateDB',
  timescaledb: 'TimescaleDB', questdb: 'QuestDB', searchapi: 'SearchAPI',
  onesimpleapi: 'One Simple API', evolutionapi: 'Evolution API',
  aitransform: 'AI Transform', gotowebinar: 'GoToWebinar', awssqs: 'AWS SQS',
  sentryio: 'Sentry', urlscanio: 'urlscan.io', dataforseo: 'DataForSEO',
  venafitlsprotectcloud: 'Venafi TLS Protect', pdftotext: 'PDF to Text',
  pdftopng: 'PDF to PNG',
}

/**
 * Display names for core nodes, where affix stripping has thrown away the part
 * that made the name meaningful (`chainLlm` strips down to `llm`) or where
 * n8n's own UI calls the node something else entirely.
 */
const NODE_LABELS: Record<string, string> = {
  chainllm: 'LLM Chain',
  chainsummarization: 'Summarization Chain',
  chainretrievalqa: 'Q&A Chain',
  agent: 'AI Agent',
  splitinbatches: 'Loop Over Items',
  noop: 'No Operation',
  set: 'Edit Fields',
  if: 'If',
  httprequest: 'HTTP Request',
  n8n: 'n8n',
  xml: 'XML',
  ssh: 'SSH',
  ftp: 'FTP',
  graphql: 'GraphQL',
  sse: 'Server-Sent Events',
  emailreadimap: 'Email (IMAP)',
  emailsend: 'Send Email',
  mcptrigger: 'MCP Server Trigger',
  mcpclienttool: 'MCP Client',
  mcpclient: 'MCP Client',
  outputparserstructured: 'Structured Output Parser',
  outputparserautofixing: 'Auto-fixing Output Parser',
  outputparseritemlist: 'Item List Output Parser',
  documentdefaultdataloader: 'Document Loader',
  textsplitterrecursivecharactertextsplitter: 'Recursive Text Splitter',
  textsplittertokensplitter: 'Token Splitter',
  memorybufferwindow: 'Window Buffer Memory',
  memorymanager: 'Chat Memory Manager',
  retrievervectorstore: 'Vector Store Retriever',
  toolvectorstore: 'Vector Store Tool',
  toolworkflow: 'Call n8n Workflow Tool',
  toolhttprequest: 'HTTP Request Tool',
  toolcalculator: 'Calculator',
  toolcode: 'Code Tool',
  executeworkflowtrigger: 'When executed by another workflow',
  manualtrigger: 'Manual Trigger',
  n8ntrainingcustomerdatastore: 'Customer Datastore',
}

/**
 * Node types - after affix stripping - that start a workflow even though they
 * do not end in `Trigger`.
 */
const EXTRA_TRIGGERS = new Set(['webhook', 'cron', 'interval', 'sse'])

const LOGIC = new Set([
  'if', 'switch', 'filter', 'merge', 'splitInBatches', 'wait', 'stopAndError',
  'noOp', 'compareDatasets', 'executeWorkflow', 'errorWorkflow',
])

const DATA = new Set([
  'set', 'code', 'function', 'functionItem', 'aggregate', 'splitOut',
  'itemLists', 'itemList', 'sort', 'limit', 'summarize', 'removeDuplicates',
  'renameKeys', 'dateTime', 'markdown', 'html', 'htmlExtract', 'xml', 'crypto',
  'extractFromFile', 'convertToFile', 'moveBinaryData', 'spreadsheetFile',
  'readWriteFile', 'readBinaryFile', 'readBinaryFiles', 'writeBinaryFile',
  'compression', 'executionData', 'debugHelper', 'editImage',
])

const OUTPUT = new Set(['respondToWebhook', 'emailSend', 'form'])

/** Strips the package, so `@n8n/n8n-nodes-langchain.agent` becomes `agent`. */
export function localType(type: string): string {
  const dot = type.lastIndexOf('.')
  return dot === -1 ? type : type.slice(dot + 1)
}

/** True for the package n8n ships its AI nodes in. */
function isLangchain(type: string): boolean {
  return type.startsWith('@n8n/n8n-nodes-langchain')
}

/**
 * Removes the role affixes that describe *how* a node is used rather than
 * *what* it talks to, so every spelling of a service folds onto one name.
 */
function stripAffixes(type: string): string {
  let local = localType(type)

  if (isLangchain(type)) {
    for (const prefix of LANGCHAIN_PREFIXES) {
      if (local.length > prefix.length && local.startsWith(prefix)) {
        local = local.slice(prefix.length)
        break
      }
    }
    // `memoryPostgresChat` and `memoryRedisChat` keep a trailing Chat.
    if (local.length > 4 && local.endsWith('Chat')) local = local.slice(0, -4)
  }

  for (const suffix of ['Trigger', 'Tool']) {
    if (local.length > suffix.length && local.endsWith(suffix)) {
      local = local.slice(0, -suffix.length)
      break
    }
  }

  return local.charAt(0).toLowerCase() + local.slice(1)
}

/** `googleSheets` -> `Google Sheets`. Keeps runs of capitals together. */
function humanize(local: string): string {
  return local
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * The service a node talks to, or `null` when the node is n8n's own machinery.
 *
 * This is what the catalog's `integrations` list is built from, so "no service"
 * has to mean exactly that - an If node is not an integration, and neither is
 * a Structured Output Parser.
 */
export function integrationOf(type: string): string | null {
  if (!type) return null
  const stripped = stripAffixes(type)
  if (!stripped || CORE.has(stripped)) return null

  const key = stripped.toLowerCase()
  return BRANDS[key] ?? humanize(stripped)
}

/** A readable name for the node type itself, integration or not. */
export function labelOf(type: string): string {
  if (!type) return 'Unknown'

  const integration = integrationOf(type)
  if (integration) return integration

  const local = localType(type)
  return NODE_LABELS[local.toLowerCase()] ?? humanize(local)
}

/** True when a node starts a workflow rather than sitting inside it. */
export function isTriggerType(type: string): boolean {
  if (!type) return false
  if (/Trigger$/.test(localType(type))) return true
  return EXTRA_TRIGGERS.has(stripAffixes(type))
}

/**
 * What colour block this node gets in the diagram.
 *
 * The point is that the eye can read a workflow's shape before any label: a
 * trigger on the left, a coral branch of app calls, a violet cluster where the
 * AI lives, grey where data is only being reshaped.
 */
export function kindOf(type: string): NodeKind {
  if (isTriggerType(type)) return 'trigger'
  if (isLangchain(type)) return 'ai'

  const stripped = stripAffixes(type)
  if (stripped === 'openAi') return 'ai'
  if (LOGIC.has(stripped)) return 'logic'
  if (DATA.has(stripped)) return 'data'
  if (OUTPUT.has(stripped)) return 'output'
  return 'app'
}
