import { useSpotify } from '../hooks/useSpotify'
import { SpotifyContext } from './SpotifyContext'

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const value = useSpotify()
  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>
}
