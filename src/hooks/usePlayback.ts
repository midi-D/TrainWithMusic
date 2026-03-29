import { useState, useRef, useCallback, useEffect } from 'react'
import type { TrainingList } from '../types'
import {
  resumeAudioContext,
  decodeAudioBlob,
  playAudioBuffer,
  scheduleBeeps,
  stopNodes,
  playApplause,
  loadApplause,
} from '../utils/audio'
import { getAudioFile } from '../utils/db'

export type PlaybackState = 'idle' | 'playing' | 'resting' | 'completed' | 'stopped'

export interface PlaybackStatus {
  state: PlaybackState
  trackIndex: number
  totalTracks: number
  remainingSecs: number   // countdown seconds for current phase
  playDuration: number    // total duration of current track
}

const BEEP_COUNT = 5

export function usePlayback() {
  const [status, setStatus] = useState<PlaybackStatus>({
    state: 'idle',
    trackIndex: 0,
    totalTracks: 0,
    remainingSecs: 0,
    playDuration: 0,
  })

  const activeSource = useRef<AudioBufferSourceNode | null>(null)
  const activeBeeps = useRef<Array<{ osc: OscillatorNode; gain: GainNode }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)
  const listRef = useRef<TrainingList | null>(null)
  const trackIndexRef = useRef(0)

  // Load applause once on mount
  useEffect(() => {
    loadApplause()
  }, [])

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const stopAll = useCallback(() => {
    clearTimer()
    if (activeSource.current) {
      try { activeSource.current.stop() } catch { /* already stopped */ }
      activeSource.current = null
    }
    stopNodes(activeBeeps.current)
    activeBeeps.current = []
  }, [clearTimer])

  const startRest = useCallback(
    (list: TrainingList, nextTrackIndex: number, startNextTrack: (idx: number) => void) => {
      if (stoppedRef.current) return
      if (list.restTimeSecs <= 0) {
        startNextTrack(nextTrackIndex)
        return
      }

      let remaining = list.restTimeSecs
      setStatus((s) => ({ ...s, state: 'resting', remainingSecs: remaining, playDuration: list.restTimeSecs }))

      intervalRef.current = setInterval(() => {
        remaining -= 0.1
        if (remaining <= 0) {
          clearTimer()
          if (!stoppedRef.current) startNextTrack(nextTrackIndex)
        } else {
          setStatus((s) => ({ ...s, remainingSecs: Math.max(0, remaining) }))
        }
      }, 100)
    },
    [clearTimer],
  )

  const startTrack = useCallback(
    async (list: TrainingList, index: number) => {
      if (stoppedRef.current) return
      if (index >= list.tracks.length) {
        // All tracks done
        setStatus((s) => ({ ...s, state: 'completed', remainingSecs: 0 }))
        playApplause()
        return
      }

      const track = list.tracks[index]
      trackIndexRef.current = index

      const fileRecord = await getAudioFile(track.fileId)
      if (!fileRecord || stoppedRef.current) return

      const buffer = await decodeAudioBlob(fileRecord.blob)
      if (stoppedRef.current) return

      const duration = track.playDuration
      setStatus({
        state: 'playing',
        trackIndex: index,
        totalTracks: list.tracks.length,
        remainingSecs: duration,
        playDuration: duration,
      })

      // Start music
      const source = playAudioBuffer(buffer, track.startOffset, duration)
      activeSource.current = source

      // Schedule beeps if enabled
      if (list.useBeeps) {
        const startOffsets: number[] = []
        const endOffsets: number[] = []

        for (let i = 0; i < BEEP_COUNT; i++) {
          if (i < duration) startOffsets.push(i)
          const endOffset = duration - BEEP_COUNT + i
          if (endOffset > BEEP_COUNT && endOffset < duration) endOffsets.push(endOffset)
        }

        activeBeeps.current = scheduleBeeps([...startOffsets, ...endOffsets])
      }

      // Countdown timer
      let remaining = duration
      intervalRef.current = setInterval(() => {
        remaining -= 0.1
        if (remaining <= 0) {
          clearTimer()
          if (!stoppedRef.current) {
            stopAll()
            startRest(list, index + 1, (nextIdx) => startTrack(list, nextIdx))
          }
        } else {
          setStatus((s) => ({ ...s, remainingSecs: Math.max(0, remaining) }))
        }
      }, 100)
    },
    [clearTimer, stopAll, startRest],
  )

  const start = useCallback(
    async (list: TrainingList) => {
      stoppedRef.current = false
      listRef.current = list
      await resumeAudioContext()
      await startTrack(list, 0)
    },
    [startTrack],
  )

  const stop = useCallback(() => {
    stoppedRef.current = true
    stopAll()
    setStatus({
      state: 'stopped',
      trackIndex: 0,
      totalTracks: 0,
      remainingSecs: 0,
      playDuration: 0,
    })
  }, [stopAll])

  const reset = useCallback(() => {
    stoppedRef.current = true
    stopAll()
    setStatus({
      state: 'idle',
      trackIndex: 0,
      totalTracks: 0,
      remainingSecs: 0,
      playDuration: 0,
    })
  }, [stopAll])

  return { status, start, stop, reset }
}
