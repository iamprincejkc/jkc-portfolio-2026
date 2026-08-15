/**
 * One-time helper: mint a Spotify refresh token for the now-playing card.
 *
 * A refresh token does not expire, so this is run once and the result goes into
 * Netlify's environment variables. Node built-ins only, no dependencies.
 *
 *   node scripts/spotify-token.mjs <CLIENT_ID> <CLIENT_SECRET>
 *
 * Before running, add this exact Redirect URI to your app at
 * https://developer.spotify.com/dashboard:
 *
 *   http://127.0.0.1:5555/callback
 */

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const [clientId, clientSecret] = process.argv.slice(2)

if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/spotify-token.mjs <CLIENT_ID> <CLIENT_SECRET>')
  process.exit(1)
}

const PORT = 5555
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`
const SCOPES = 'user-read-currently-playing user-read-recently-played'
const state = randomBytes(8).toString('hex')

const authorizeUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  })

console.log('\nOpen this URL in your browser and approve access:\n')
console.log(authorizeUrl)
console.log('\nWaiting for the redirect...\n')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (url.pathname !== '/callback') {
    res.writeHead(404).end()
    return
  }

  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')

  const finish = (message) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:3rem">${message}</body>`)
  }

  // The state check is what stops a third party feeding you their own auth code.
  if (!code || returnedState !== state) {
    finish('Authorisation failed. Check the terminal.')
    console.error('\nAuthorisation failed:', url.searchParams.get('error') ?? 'state mismatch')
    server.close()
    process.exit(1)
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.refresh_token) {
      finish('Token exchange failed. Check the terminal.')
      console.error('\nToken exchange failed:', data)
      server.close()
      process.exit(1)
    }

    finish('Done. You can close this tab and return to the terminal.')

    console.log('Add these three to Netlify (Site configuration -> Environment variables):\n')
    console.log(`NUXT_SPOTIFY_CLIENT_ID=${clientId}`)
    console.log(`NUXT_SPOTIFY_CLIENT_SECRET=${clientSecret}`)
    console.log(`NUXT_SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`)
    console.log('The refresh token does not expire. Keep it secret - it reads your listening history.\n')
  } catch (error) {
    finish('Token exchange failed. Check the terminal.')
    console.error('\nToken exchange failed:', error)
  } finally {
    server.close()
  }
})

server.listen(PORT, '127.0.0.1')
