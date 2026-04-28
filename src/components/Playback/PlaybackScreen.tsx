import { useEffect, useRef } from 'react'
import type { TrainingList } from '../../types'
import { usePlayback } from '../../hooks/usePlayback'
import { CountdownTimer } from './CountdownTimer'
import { KeepAwake } from '@capacitor-community/keep-awake'

interface Props {
  list: TrainingList
  onExit: () => void
}

export function PlaybackScreen({ list, onExit }: Props) {
  const { status, start, stop, pause, resume, skipForward, skipBack } = usePlayback()
  const startedRef = useRef(false)

  useEffect(() => {
    KeepAwake.keepAwake()
    return () => { KeepAwake.allowSleep() }
  }, [])

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

  const isCompleted = status.state === 'completed'
  const isPreparing = status.state === 'preparing'
  const isResting = status.state === 'resting'
  const isActive = ['playing', 'resting', 'preparing'].includes(status.state)
  const isPaused = status.state === 'paused'

  // When paused during rest/preparing, keep showing the rest UI (red timer, correct labels)
  const effectiveRestState = isPreparing ? 'preparing'
    : isResting ? 'resting'
    : (isPaused && status.pausedRestState) ? status.pausedRestState
    : null
  const showRestUI = !!effectiveRestState

  const track = status.trackIndex < list.tracks.length ? list.tracks[status.trackIndex] : null
  const nextTrack = list.tracks[status.trackIndex + 1]
  const nextLabel = nextTrack
    ? `Next: ${nextTrack.exerciseTitle || nextTrack.fileName}`
    : 'Next: Almost done!'

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-950 flex flex-col select-none">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 pt-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="text-gray-400 dark:text-gray-500 text-sm font-medium w-24">
          {!isCompleted && !isPreparing && (
            <>Track {status.trackIndex + 1} / {status.totalTracks}</>
          )}
        </div>
        <button
          onClick={handleStop}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 text-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition"
          aria-label="Stop playback"
        >
          ✕
        </button>
      </div>

      {/* Middle: timer + labels */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        {isCompleted ? (
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <div
              className="font-bold text-green-400"
              style={{ fontSize: 'clamp(3rem, 15vw, 8rem)' }}
            >
              SUCCESS!
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xl">Great workout!</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {showRestUI ? (
              <>
                <div className="text-gray-500 dark:text-gray-400 text-2xl font-semibold uppercase tracking-widest mb-2">
                  {effectiveRestState === 'preparing' ? 'Get Ready!' : 'Rest'}
                </div>
                <CountdownTimer remainingSecs={status.remainingSecs} isRest />
                {effectiveRestState === 'resting' && (
                  <div className="text-gray-500 dark:text-gray-400 text-xl mt-4">
                    {nextLabel}
                  </div>
                )}
                {effectiveRestState === 'preparing' && track && (
                  <div className="text-gray-400 dark:text-gray-500 text-xl mt-4">
                    {track.exerciseTitle || track.fileName}
                  </div>
                )}
              </>
            ) : (
              <>
                <CountdownTimer remainingSecs={status.remainingSecs} />
                {track && (
                  <div
                    className="text-gray-900 dark:text-white font-semibold mt-4"
                    style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}
                  >
                    {track.exerciseTitle || track.fileName}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {!isCompleted && (
        <div
          className="flex items-center justify-center gap-10"
          style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))', paddingTop: '1rem' }}
        >
          <button
            onClick={skipBack}
            disabled={!isActive && !isPaused}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-2xl text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 disabled:opacity-30 transition"
            aria-label="Skip back"
          >
            ⏮
          </button>
          <button
            onClick={isActive ? pause : resume}
            disabled={!isActive && !isPaused}
            className="w-18 h-18 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-3xl text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 disabled:opacity-30 transition"
            style={{ width: '4.5rem', height: '4.5rem' }}
            aria-label={isActive ? 'Pause' : 'Resume'}
          >
            {isActive ? '⏸' : '▶'}
          </button>
          <button
            onClick={skipForward}
            disabled={!isActive && !isPaused}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-2xl text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 disabled:opacity-30 transition"
            aria-label="Skip forward"
          >
            ⏭
          </button>
        </div>
      )}
    </div>
  )
}
