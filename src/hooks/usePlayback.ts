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

export type PlaybackState = 'idle' | 'preparing' | 'playing' | 'paused' | 'resting' | 'completed' | 'stopped'

export interface PlaybackStatus {
  state: PlaybackState
  trackIndex: number
  totalTracks: number
  remainingSecs: number
  playDuration: number
  /** Set when paused during rest or preparing — keeps rest UI active while paused */
  pausedRestState?: 'resting' | 'preparing'
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

  // Mirror status into a ref so callbacks don't go stale
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  const activeSource = useRef<AudioBufferSourceNode | null>(null)
  const activeBeeps = useRef<Array<{ osc: OscillatorNode; gain: GainNode }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)
  const listRef = useRef<TrainingList | null>(null)
  const trackIndexRef = useRef(0)

  // Cached decoded buffer so resume doesn't need to re-fetch IndexedDB
  const cachedBufferRef = useRef<AudioBuffer | null>(null)
  const cachedFileIdRef = useRef<string | null>(null)

  // Pause state
  const pausedElapsedRef = useRef(0)         // secs elapsed in track when paused
  const pausedInRestRef = useRef(false)       // was paused during rest/preparing?
  const pausedRestRemainingRef = useRef(0)
  const pausedRestStateRef = useRef<'resting' | 'preparing'>('resting')

  // Rest state for skip/resume
  const nextRestTrackIndexRef = useRef(0)
  const restEndCallbackRef = useRef<(() => void) | null>(null)

  useEffect(() => { loadApplause() }, [])

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

  // startRest handles both normal rests and the initial "Get Ready!" (restState='preparing')
  const startRest = useCallback(
    (
      list: TrainingList,
      nextTrackIndex: number,
      startNextTrack: (idx: number) => void,
      restState: 'resting' | 'preparing' = 'resting',
    ) => {
      if (stoppedRef.current) return
      if (list.restTimeSecs <= 0) {
        startNextTrack(nextTrackIndex)
        return
      }

      nextRestTrackIndexRef.current = nextTrackIndex
      const endCallback = () => startNextTrack(nextTrackIndex)
      restEndCallbackRef.current = endCallback

      if (list.useBeeps) {
        const restDuration = list.restTimeSecs
        const beepOffsets: number[] = []
        for (let i = 0; i < BEEP_COUNT; i++) {
          const offset = restDuration - (BEEP_COUNT - 1 - i)
          if (offset >= 0) beepOffsets.push(offset)
        }
        if (beepOffsets.length > 0) {
          activeBeeps.current = [...activeBeeps.current, ...scheduleBeeps(beepOffsets)]
        }
      }

      const totalDuration = list.restTimeSecs
      if (restState === 'preparing') {
        setStatus({
          state: 'preparing',
          trackIndex: 0,
          totalTracks: list.tracks.length,
          remainingSecs: totalDuration,
          playDuration: totalDuration,
        })
      } else {
        // Explicitly set trackIndex = nextTrackIndex - 1 so that nextLabel always
        // resolves to list.tracks[nextTrackIndex] regardless of where we came from
        setStatus((s) => ({
          ...s,
          state: 'resting',
          trackIndex: nextTrackIndex - 1,
          remainingSecs: totalDuration,
          playDuration: totalDuration,
        }))
      }

      let remaining = totalDuration
      intervalRef.current = setInterval(() => {
        remaining -= 0.1
        if (remaining <= 0) {
          clearTimer()
          if (!stoppedRef.current) endCallback()
        } else {
          setStatus((s) => ({ ...s, remainingSecs: Math.max(0, remaining) }))
        }
      }, 100)
    },
    [clearTimer],
  )

  // startTrack accepts elapsedSecs so it can resume mid-track
  const startTrack = useCallback(
    async (list: TrainingList, index: number, elapsedSecs: number = 0) => {
      if (stoppedRef.current) return
      if (index >= list.tracks.length) {
        setStatus((s) => ({ ...s, state: 'completed', remainingSecs: 0 }))
        playApplause()
        return
      }

      const track = list.tracks[index]
      trackIndexRef.current = index

      // Use cached buffer when resuming the same file; otherwise decode fresh
      let buffer: AudioBuffer
      if (elapsedSecs > 0 && cachedBufferRef.current && cachedFileIdRef.current === track.fileId) {
        buffer = cachedBufferRef.current
      } else {
        const fileRecord = await getAudioFile(track.fileId)
        if (!fileRecord || stoppedRef.current) return
        buffer = await decodeAudioBlob(fileRecord.blob)
        if (stoppedRef.current) return
        cachedBufferRef.current = buffer
        cachedFileIdRef.current = track.fileId
      }

      const duration = track.playDuration
      const filePosition = track.startOffset + elapsedSecs
      const remaining = Math.max(0.1, duration - elapsedSecs)

      setStatus({
        state: 'playing',
        trackIndex: index,
        totalTracks: list.tracks.length,
        remainingSecs: remaining,
        playDuration: duration,
      })

      const source = playAudioBuffer(buffer, filePosition, remaining)
      activeSource.current = source

      // Only schedule end beeps that haven't fired yet
      if (list.useBeeps) {
        const endOffsets: number[] = []
        for (let i = 0; i < BEEP_COUNT; i++) {
          const offsetFromNow = duration - BEEP_COUNT + i - elapsedSecs
          if (offsetFromNow >= 0 && offsetFromNow < remaining) endOffsets.push(offsetFromNow)
        }
        if (endOffsets.length > 0) {
          activeBeeps.current = scheduleBeeps(endOffsets)
        }
      }

      let rem = remaining
      intervalRef.current = setInterval(() => {
        rem -= 0.1
        if (rem <= 0) {
          clearTimer()
          if (!stoppedRef.current) {
            stopAll()
            if (index + 1 >= list.tracks.length) {
              setStatus((s) => ({ ...s, state: 'completed', remainingSecs: 0 }))
              playApplause()
            } else {
              startRest(list, index + 1, (nextIdx) => startTrack(list, nextIdx))
            }
          }
        } else {
          setStatus((s) => ({ ...s, remainingSecs: Math.max(0, rem) }))
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

      if (list.restTimeSecs > 0) {
        startRest(list, 0, (idx) => startTrack(list, idx), 'preparing')
      } else {
        await startTrack(list, 0)
      }
    },
    [startRest, startTrack],
  )

  const pause = useCallback(() => {
    const state = statusRef.current.state
    if (state !== 'playing' && state !== 'resting' && state !== 'preparing') return

    if (state === 'playing') {
      const list = listRef.current
      const track = list?.tracks[trackIndexRef.current]
      pausedElapsedRef.current = Math.max(0, (track?.playDuration ?? 0) - statusRef.current.remainingSecs)
      pausedInRestRef.current = false
    } else {
      pausedRestRemainingRef.current = statusRef.current.remainingSecs
      pausedInRestRef.current = true
      pausedRestStateRef.current = state as 'resting' | 'preparing'
    }

    stopAll()
    setStatus((s) => ({
      ...s,
      state: 'paused',
      pausedRestState: pausedInRestRef.current ? pausedRestStateRef.current : undefined,
    }))
  }, [stopAll])

  const resume = useCallback(() => {
    if (statusRef.current.state !== 'paused') return
    const list = listRef.current
    if (!list) return
    stoppedRef.current = false

    if (pausedInRestRef.current) {
      const restState = pausedRestStateRef.current
      let rem = pausedRestRemainingRef.current
      const callback = restEndCallbackRef.current

      // Reschedule any beeps that haven't fired yet
      if (list.useBeeps) {
        const beepOffsets: number[] = []
        for (let i = 0; i < BEEP_COUNT; i++) {
          const offsetFromNow = rem - (BEEP_COUNT - 1 - i)
          if (offsetFromNow >= 0) beepOffsets.push(offsetFromNow)
        }
        if (beepOffsets.length > 0) {
          activeBeeps.current = scheduleBeeps(beepOffsets)
        }
      }

      setStatus((s) => ({ ...s, state: restState, remainingSecs: rem, pausedRestState: undefined }))
      intervalRef.current = setInterval(() => {
        rem -= 0.1
        if (rem <= 0) {
          clearTimer()
          if (!stoppedRef.current && callback) callback()
        } else {
          setStatus((s) => ({ ...s, remainingSecs: Math.max(0, rem) }))
        }
      }, 100)
    } else {
      startTrack(list, trackIndexRef.current, pausedElapsedRef.current)
    }
  }, [clearTimer, startTrack])

  // Jump to "paused at rest before targetIdx" without starting playback
  const pauseAtRest = useCallback((list: TrainingList, targetIdx: number) => {
    const restState: 'resting' | 'preparing' = targetIdx === 0 ? 'preparing' : 'resting'
    nextRestTrackIndexRef.current = targetIdx
    restEndCallbackRef.current = () => startTrack(list, targetIdx)
    pausedInRestRef.current = true
    pausedRestRemainingRef.current = list.restTimeSecs
    pausedRestStateRef.current = restState
    setStatus({
      state: 'paused',
      trackIndex: targetIdx === 0 ? 0 : targetIdx - 1,
      totalTracks: list.tracks.length,
      remainingSecs: list.restTimeSecs,
      playDuration: list.restTimeSecs,
      pausedRestState: restState,
    })
  }, [startTrack])

  const skipForward = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const state = statusRef.current.state
    if (!['playing', 'resting', 'preparing', 'paused'].includes(state)) return

    const inRest = state === 'resting' || state === 'preparing' ||
      (state === 'paused' && pausedInRestRef.current)
    // Next rest is before track: (current rest's next track) + 1, or (current track) + 1
    const nextIdx = inRest
      ? nextRestTrackIndexRef.current + 1
      : trackIndexRef.current + 1

    const wasActive = state === 'playing' || state === 'resting' || state === 'preparing'

    stopAll()
    stoppedRef.current = false

    if (nextIdx >= list.tracks.length) {
      setStatus((s) => ({ ...s, state: 'completed', remainingSecs: 0, pausedRestState: undefined }))
      playApplause()
    } else if (wasActive) {
      startRest(list, nextIdx, (idx) => startTrack(list, idx), nextIdx === 0 ? 'preparing' : 'resting')
    } else {
      pauseAtRest(list, nextIdx)
    }
  }, [stopAll, startRest, startTrack, pauseAtRest])

  const skipBack = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const state = statusRef.current.state
    if (!['playing', 'resting', 'preparing', 'paused'].includes(state)) return

    const inRest = state === 'resting' || state === 'preparing' ||
      (state === 'paused' && pausedInRestRef.current)
    // When in rest: go to rest before previous track (min 0 = preparing)
    // When playing: go to rest before same track
    const targetIdx = inRest
      ? Math.max(0, nextRestTrackIndexRef.current - 1)
      : trackIndexRef.current

    const wasActive = state === 'playing' || state === 'resting' || state === 'preparing'

    stopAll()
    stoppedRef.current = false

    if (wasActive) {
      startRest(list, targetIdx, (idx) => startTrack(list, idx), targetIdx === 0 ? 'preparing' : 'resting')
    } else {
      pauseAtRest(list, targetIdx)
    }
  }, [stopAll, startRest, startTrack, pauseAtRest])

  const stop = useCallback(() => {
    stoppedRef.current = true
    stopAll()
    setStatus({ state: 'stopped', trackIndex: 0, totalTracks: 0, remainingSecs: 0, playDuration: 0 })
  }, [stopAll])

  const reset = useCallback(() => {
    stoppedRef.current = true
    stopAll()
    setStatus({ state: 'idle', trackIndex: 0, totalTracks: 0, remainingSecs: 0, playDuration: 0 })
  }, [stopAll])

  return { status, start, stop, reset, pause, resume, skipForward, skipBack }
}
