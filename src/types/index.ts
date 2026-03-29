export interface Track {
  id: string
  fileId: string       // IndexedDB key in audioFiles store
  fileName: string
  exerciseTitle: string
  startOffset: number  // seconds into the file to begin playback
  playDuration: number // seconds to play
}

export interface TrainingList {
  id: string
  name: string
  tracks: Track[]
  restTimeSecs: number
  useBeeps: boolean
  lastModified: string // ISO date string
}

export type Screen =
  | { type: 'main' }
  | { type: 'about' }
  | { type: 'editor'; listId: string | null }
  | { type: 'playback'; listId: string }
