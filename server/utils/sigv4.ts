import { createHash, createHmac } from 'node:crypto'

/**
 * AWS Signature Version 4, which R2 speaks through its S3-compatible API.
 *
 * Implemented directly rather than pulling in the AWS SDK, for the same reason
 * `cloudinary.ts` hashes its own signatures: a few HMACs do not justify loading
 * megabytes of SDK into a serverless function. Both signing modes are pinned by
 * unit tests against the worked examples in AWS's own documentation.
 *
 * - `presignUrl` puts the signature in the query string. Used for requests the
 *   browser makes itself (uploading a part, playing a video), so the secret
 *   never leaves the server.
 * - `signHeaders` puts it in an Authorization header. Used for requests the
 *   server makes, which is the form every S3-compatible API accepts for every
 *   operation.
 */

export type SigningCredentials = {
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
}

type RequestShape = {
  method: string
  host: string
  /** Raw, unencoded path starting with `/`. */
  path: string
  query?: Record<string, string>
  /** Headers that must be signed. `host` is always added. */
  headers?: Record<string, string>
  date?: Date
}

const ALGORITHM = 'AWS4-HMAC-SHA256'

/** SigV4's encoding: RFC 3986, where only unreserved characters stay literal. */
export function uriEncode(value: string, encodeSlash = true): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return encodeSlash ? encoded : encoded.replace(/%2F/g, '/')
}

/** `20130524T000000Z` */
export function amzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest()
}

function canonicalQueryString(query: Record<string, string>): string {
  return Object.entries(query)
    .map(([key, value]) => [uriEncode(key), uriEncode(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function lowerCaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  )
}

function sign(
  credentials: SigningCredentials,
  stamp: string,
  canonicalRequest: string,
): { scope: string; signature: string } {
  const day = stamp.slice(0, 8)
  const scope = `${day}/${credentials.region}/${credentials.service}/aws4_request`
  const stringToSign = [ALGORITHM, stamp, scope, sha256Hex(canonicalRequest)].join('\n')

  let key = hmac(`AWS4${credentials.secretAccessKey}`, day)
  key = hmac(key, credentials.region)
  key = hmac(key, credentials.service)
  key = hmac(key, 'aws4_request')

  return { scope, signature: createHmac('sha256', key).update(stringToSign).digest('hex') }
}

function canonicalRequest(
  method: string,
  path: string,
  query: string,
  headers: Record<string, string>,
  payloadHash: string,
): { request: string; signedHeaders: string } {
  const names = Object.keys(headers).sort()
  const signedHeaders = names.join(';')
  // Each header line carries its own trailing newline, so the join below
  // produces the blank line SigV4 expects before the signed-header list.
  const canonicalHeaders = names
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, ' ')}\n`)
    .join('')

  return {
    request: [method.toUpperCase(), uriEncode(path, false), query, canonicalHeaders, signedHeaders, payloadHash].join('\n'),
    signedHeaders,
  }
}

/**
 * A URL anyone holding it can use for `expiresIn` seconds, for exactly this
 * method, path and set of signed headers.
 */
export function presignUrl(
  credentials: SigningCredentials,
  request: RequestShape & { expiresIn: number },
): string {
  const stamp = amzDate(request.date ?? new Date())
  const headers = { ...lowerCaseKeys(request.headers ?? {}), host: request.host }
  const signedHeaderNames = Object.keys(headers).sort().join(';')
  const scope = `${stamp.slice(0, 8)}/${credentials.region}/${credentials.service}/aws4_request`

  const query = canonicalQueryString({
    ...request.query,
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${credentials.accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(request.expiresIn),
    'X-Amz-SignedHeaders': signedHeaderNames,
  })

  const { request: canonical } = canonicalRequest(
    request.method,
    request.path,
    query,
    headers,
    'UNSIGNED-PAYLOAD',
  )
  const { signature } = sign(credentials, stamp, canonical)

  return `https://${request.host}${uriEncode(request.path, false)}?${query}&X-Amz-Signature=${signature}`
}

/**
 * Headers to send with a server-made request: everything that was signed, plus
 * the Authorization header. The body is hashed, so it must be sent byte for
 * byte as given.
 */
export function signHeaders(
  credentials: SigningCredentials,
  request: RequestShape & { body?: string },
): { url: string; headers: Record<string, string> } {
  const stamp = amzDate(request.date ?? new Date())
  const payloadHash = sha256Hex(request.body ?? '')
  const headers = {
    ...lowerCaseKeys(request.headers ?? {}),
    host: request.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
  }

  const query = canonicalQueryString(request.query ?? {})
  const { request: canonical, signedHeaders } = canonicalRequest(
    request.method,
    request.path,
    query,
    headers,
    payloadHash,
  )
  const { scope, signature } = sign(credentials, stamp, canonical)

  // `host` is set by fetch itself from the URL and cannot be overridden.
  const { host: _host, ...sendable } = headers

  return {
    url: `https://${request.host}${uriEncode(request.path, false)}${query ? `?${query}` : ''}`,
    headers: {
      ...sendable,
      authorization: `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  }
}
