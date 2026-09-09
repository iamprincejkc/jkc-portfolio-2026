/**
 * Stripping other people's credentials out of the workflow corpus.
 *
 * These files are real exports from real n8n instances, and some of their
 * authors left live keys inside them - in a URL, a header, a code node. Eight
 * of the 1,971 do. Republishing those would put someone else's working
 * credential on a public site under somebody else's name, and serve it as a
 * plain JSON file to anyone who asks.
 *
 * GitHub's push protection catches a couple of them. That is not a safety net
 * worth relying on: it only scans for the vendor patterns it has partner
 * agreements for, and it found two of the eight here. The corpus has to be
 * cleaned on the way in.
 *
 * Redaction rather than dropping the file: the workflow is still worth
 * reading, and a placeholder is a clearer instruction than a missing entry.
 * The reader has to supply their own key either way - which is how n8n
 * credentials are meant to work, and why a key sitting inline was a mistake
 * in the first place.
 *
 * Every pattern here is vendor-prefixed and unambiguous. That is deliberate:
 * a loose "long random-looking string" rule would eat node IDs, webhook paths
 * and instance hashes, and quietly corrupt workflows to guard against nothing.
 */

export const REDACTED = '<redacted-credential>'

/**
 * Credential shapes with a distinctive prefix or structure.
 *
 * Ordered longest-prefix-first where two could overlap, so `sk-ant-` is not
 * consumed by the more general `sk-`.
 */
const PATTERNS: readonly RegExp[] = [
  // Whole PEM blocks, not just the header line.
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /\bpplx-[A-Za-z0-9]{20,}/g,
  /\bapify_api_[A-Za-z0-9]{20,}/g,
  /\bAIza[A-Za-z0-9_-]{35}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
  /hooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+/g,
  /discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{50,}/g,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g,
  /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
  /\bre_[A-Za-z0-9]{20,}/g,
  /\bhf_[A-Za-z0-9]{30,}/g,
  /\b\d{8,10}:AA[A-Za-z0-9_-]{32,}/g,
  /\bkey-[0-9a-f]{32}\b/g,
  /\bsecret_[A-Za-z0-9]{40,}\b/g,
  /\bntn_[A-Za-z0-9]{40,}\b/g,
  /\bpat[A-Za-z0-9]{14}\.[A-Za-z0-9]{40,}\b/g,
  // A signed JWT: three base64url segments, the first two decoding to JSON.
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
]

/** Replaces every credential-shaped run in one string. */
export function redactString(value: string): string {
  let out = value
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0
    out = out.replace(pattern, REDACTED)
  }
  return out
}

/** True if this string contains anything that looks like a credential. */
export function hasSecret(value: string): boolean {
  return PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(value)
  })
}

/**
 * Walks a parsed workflow and redacts every string in it, wherever it sits.
 *
 * Structural: keys, arrays and nesting are preserved exactly, so the result
 * still imports into n8n. Only string *values* are rewritten - a key called
 * `apiKey` keeps its name, and only what it holds is replaced.
 *
 * Returns the count as well, because a build that silently redacts nothing
 * and a build that silently redacts four hundred things should not look the
 * same in the log.
 */
export function redactWorkflow<T>(workflow: T): { workflow: T; redactions: number } {
  let redactions = 0

  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (!hasSecret(value)) return value
      redactions += 1
      return redactString(value)
    }
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        out[key] = walk(nested)
      }
      return out
    }
    return value
  }

  return { workflow: walk(workflow) as T, redactions }
}
