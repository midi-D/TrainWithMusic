import { useState, useEffect, useRef, useCallback } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import type { SpotifyContextValue } from '../contexts/SpotifyContext'
import type { SpotifyStatus } from '../types'
import {
  generatePKCE,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  loadTokens,
  clearTokens,
  loadPKCEState,
  type StoredTokens,
} from '../utils/spotify-auth'

async function fetchSpotifyProfile(accessToken: string): Promise<{ displayName: string; isPremium: boolean }> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
  const data = await res.json()
  return {
    displayName: (data.display_name as string | null) || (data.id as string),
    isPremium: data.product === 'premium',
  }
}

export function useSpotify(): SpotifyContextValue {
  const [status, setStatus] = useState<SpotifyStatus>('disconnected')
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [player, setPlayer] = useState<Spotify.Player | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const playerRef = useRef<Spotify.Player | null>(null)
  const sdkReadyRef = useRef(false)
  const tokensRef = useRef<StoredTokens | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs so initPlayer/scheduleRefresh can call each other without stale closures
  const initPlayerRef = useRef<((accessToken: string) => void) | null>(null)
  const scheduleRefreshRef = useRef<((tokens: StoredTokens) => void) | null>(null)

  useEffect(() => {
    function scheduleRefresh(tokens: StoredTokens) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      const delay = Math.max(0, tokens.expiresAt - Date.now() - 60_000)
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const newTokens = await refreshAccessToken(tokens.refreshToken)
          tokensRef.current = newTokens
          scheduleRefreshRef.current?.(newTokens)
          initPlayerRef.current?.(newTokens.accessToken)
        } catch {
          setStatus('error')
          setErrorMessage('Session expired. Please reconnect.')
          clearTokens()
          tokensRef.current = null
        }
      }, delay)
    }
    scheduleRefreshRef.current = scheduleRefresh

    function initPlayer(accessToken: string) {
      if (!sdkReadyRef.current || !window.Spotify) return

      // Disconnect any existing player first
      if (playerRef.current) {
        playerRef.current.disconnect()
        playerRef.current = null
      }

      const p = new window.Spotify.Player({
        name: 'TrainWithMusic',
        getOAuthToken: (cb) => cb(accessToken),
        volume: 1.0,
      })

      p.addListener('ready', ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id)
        setStatus('connected')
      })

      p.addListener('not_ready', () => setDeviceId(null))

      p.addListener('account_error', () => {
        setStatus('error')
        setErrorMessage('Spotify Premium is required for playback.')
        p.disconnect()
        playerRef.current = null
        setPlayer(null)
        clearTokens()
        tokensRef.current = null
      })

      p.addListener('authentication_error', async () => {
        const tokens = tokensRef.current
        if (!tokens?.refreshToken) {
          setStatus('error')
          setErrorMessage('Authentication failed. Please reconnect.')
          clearTokens()
          tokensRef.current = null
          return
        }
        try {
          const newTokens = await refreshAccessToken(tokens.refreshToken)
          tokensRef.current = newTokens
          scheduleRefreshRef.current?.(newTokens)
          initPlayerRef.current?.(newTokens.accessToken)
        } catch {
          setStatus('error')
          setErrorMessage('Session expired. Please reconnect.')
          clearTokens()
          tokensRef.current = null
        }
      })

      p.addListener('initialization_error', ({ message }: { message: string }) => {
        setStatus('error')
        setErrorMessage(`Playback initialization failed: ${message}`)
      })

      p.connect()
      playerRef.current = p
      setPlayer(p)
    }
    initPlayerRef.current = initPlayer

    // Called when OAuth redirects back with an authorization code
    async function processOAuthCode(code: string, state: string) {
      const storedState = loadPKCEState()
      if (state !== storedState) {
        setStatus('error')
        setErrorMessage('Authentication failed: state mismatch.')
        return
      }
      try {
        const tokens = await exchangeCode(code)
        tokensRef.current = tokens
        const profile = await fetchSpotifyProfile(tokens.accessToken)
        setDisplayName(profile.displayName)
        setIsPremium(profile.isPremium)
        setStatus('connecting')
        scheduleRefresh(tokens)
        if (sdkReadyRef.current) initPlayer(tokens.accessToken)
      } catch {
        setStatus('error')
        setErrorMessage('Login failed. Please try again.')
        clearTokens()
        tokensRef.current = null
      }
    }

    // SDK ready callback — fires when the Web Playback SDK script loads
    window.onSpotifyWebPlaybackSDKReady = () => {
      sdkReadyRef.current = true
      if (tokensRef.current) initPlayer(tokensRef.current.accessToken)
    }
    // Handle race where SDK loaded before React mounted
    if (typeof window.Spotify !== 'undefined') sdkReadyRef.current = true

    // Restore session from stored tokens
    const storedTokens = loadTokens()
    if (storedTokens) {
      tokensRef.current = storedTokens
      setStatus('connecting')
      fetchSpotifyProfile(storedTokens.accessToken)
        .then((profile) => {
          setDisplayName(profile.displayName)
          setIsPremium(profile.isPremium)
          scheduleRefresh(storedTokens)
          if (sdkReadyRef.current) initPlayer(storedTokens.accessToken)
        })
        .catch(async () => {
          // Access token likely expired — try refresh
          try {
            const newTokens = await refreshAccessToken(storedTokens.refreshToken)
            tokensRef.current = newTokens
            const profile = await fetchSpotifyProfile(newTokens.accessToken)
            setDisplayName(profile.displayName)
            setIsPremium(profile.isPremium)
            scheduleRefresh(newTokens)
            if (sdkReadyRef.current) initPlayer(newTokens.accessToken)
          } catch {
            clearTokens()
            tokensRef.current = null
            setStatus('disconnected')
          }
        })
    }

    // Web browser: detect Spotify redirect by presence of code + state query params
    const currentUrl = new URL(window.location.href)
    const webCode = currentUrl.searchParams.get('code')
    const webState = currentUrl.searchParams.get('state')
    if (webCode && webState) {
      window.history.replaceState({}, '', '/')
      processOAuthCode(webCode, webState)
    }

    // Native: listen for deep link from Spotify redirect (trainwithmusic://callback)
    let removeNativeListener: (() => void) | null = null
    CapacitorApp.addListener('appUrlOpen', async (event) => {
      try {
        const url = new URL(event.url)
        if (url.protocol === 'trainwithmusic:' && url.hostname === 'callback') {
          await Browser.close()
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')
          if (code && state) processOAuthCode(code, state)
        }
      } catch {
        // Ignore non-parseable URLs
      }
    }).then((listener) => {
      removeNativeListener = () => listener.remove()
    })

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      playerRef.current?.disconnect()
      removeNativeListener?.()
    }
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setErrorMessage(null)
    try {
      const { challenge, state } = await generatePKCE()
      await Browser.open({ url: buildAuthUrl(challenge, state), presentationStyle: 'popover' })
    } catch {
      setStatus('disconnected')
      setErrorMessage('Could not open Spotify login.')
    }
  }, [])

  const disconnect = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    playerRef.current?.disconnect()
    playerRef.current = null
    tokensRef.current = null
    setPlayer(null)
    setDeviceId(null)
    setDisplayName(null)
    setIsPremium(false)
    setStatus('disconnected')
    setErrorMessage(null)
    clearTokens()
  }, [])

  return { status, displayName, isPremium, player, deviceId, errorMessage, connect, disconnect }
}
