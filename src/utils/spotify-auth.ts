import { Capacitor } from '@capacitor/core'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
  'playlist-read-private',
  'user-library-read',
].join(' ')

const TOKENS_KEY = 'twm_spotify_tokens'
const PKCE_KEY = 'twm_spotify_pkce'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Date.now() + expires_in * 1000
}

function getRedirectUri(): string {
  return Capacitor.isNativePlatform()
    ? 'trainwithmusic://callback'
    // Spotify rejects 'localhost' by name — replace with explicit IPv4
    : `${window.location.origin.replace('localhost', '127.0.0.1')}/callback`
}

function base64urlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifierBytes = new Uint8Array(32)
  crypto.getRandomValues(verifierBytes)
  const verifier = base64urlEncode(verifierBytes.buffer)

  const challengeBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64urlEncode(challengeBytes)

  const stateBytes = new Uint8Array(16)
  crypto.getRandomValues(stateBytes)
  const state = base64urlEncode(stateBytes.buffer)

  localStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }))
  return { verifier, challenge, state }
}

export function buildAuthUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })
  return `https://accounts.spotify.com/authorize?${params}`
}

export async function exchangeCode(code: string): Promise<StoredTokens> {
  const raw = localStorage.getItem(PKCE_KEY)
  if (!raw) throw new Error('PKCE verifier missing')
  const { verifier } = JSON.parse(raw) as { verifier: string; state: string }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json()

  localStorage.removeItem(PKCE_KEY)
  return saveTokens({
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
  })
}

export async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()

  return saveTokens({
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string | undefined) ?? refreshToken,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
  })
}

export function saveTokens(tokens: StoredTokens): StoredTokens {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  return tokens
}

export function loadTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? (JSON.parse(raw) as StoredTokens) : null
  } catch {
    return null
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY)
  localStorage.removeItem(PKCE_KEY)
}

export function loadPKCEState(): string | null {
  try {
    const raw = localStorage.getItem(PKCE_KEY)
    return raw ? (JSON.parse(raw) as { state: string }).state : null
  } catch {
    return null
  }
}
