import { useEffect, useRef } from 'react'
import type { TrainingList } from '../../types'
import { usePlayback } from '../../hooks/usePlayback'
import { CountdownTimer } from './CountdownTimer'

interface Props {
  list: TrainingList
  onExit: () => void
}

export function PlaybackScreen({ list, onExit }: Props) {
  const { status, start, stop } = usePlayback()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      start(list)
    }
  }, [list, start])

  // Auto-return to main after success
  useEffect(() => {
    if (status.state === 'completed') {
      const t = setTimeout(() => onExit(), 3500)
      return () => clearTimeout(t)
    }
  }, [status.state, onExit])

  const handleStop = () => {
    stop()
    onExit()
  }

  const track = status.trackIndex < list.tracks.length ? list.tracks[status.trackIndex] : null

  const isCompleted = status.state === 'completed'
  const isResting = status.state === 'resting'

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center select-none">
      {/* Stop button */}
      <button
        onClick={handleStop}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 text-xl font-bold hover:bg-gray-700 active:scale-95 transition z-10"
        aria-label="Stop playback"
      >
        ✕
      </button>

      {/* Track counter */}
      <div className="absolute top-4 left-4 text-gray-500 text-sm font-medium">
        {!isCompleted && (
          <>Track {status.trackIndex + 1} / {status.totalTracks}</>
        )}
      </div>

      {isCompleted ? (
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div
            className="font-bold text-green-400"
            style={{ fontSize: 'clamp(3rem, 15vw, 8rem)' }}
          >
            SUCCESS!
          </div>
          <div className="text-gray-400 text-xl">Great workout!</div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          {isResting ? (
            <>
              <div className="text-gray-400 text-2xl font-semibold uppercase tracking-widest mb-2">
                Rest
              </div>
              <CountdownTimer
                remainingSecs={status.remainingSecs}
                playDuration={status.playDuration}
              />
              {track && (
                <div className="text-gray-500 text-xl mt-4">
                  Next: {track.exerciseTitle || track.fileName}
                </div>
              )}
            </>
          ) : (
            <>
              <CountdownTimer
                remainingSecs={status.remainingSecs}
                playDuration={status.playDuration}
              />
              {track && (
                <div
                  className="text-white font-semibold mt-4"
                  style={{ fontSize: 'clamp(1.25rem, 4vw, 2.5rem)' }}
                >
                  {track.exerciseTitle || track.fileName}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
