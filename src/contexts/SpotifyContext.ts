import { createContext, useContext } from 'react'
import type { SpotifyStatus } from '../types'

export interface SpotifyContextValue {
  status: SpotifyStatus
  displayName: string | null
  isPremium: boolean
  player: Spotify.Player | null
  deviceId: string | null
  errorMessage: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

export const SpotifyContext = createContext<SpotifyContextValue | null>(null)

export function useSpotifyContext(): SpotifyContextValue {
  const ctx = useContext(SpotifyContext)
  if (!ctx) throw new Error('useSpotifyContext must be used within SpotifyProvider')
  return ctx
}
