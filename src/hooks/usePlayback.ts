import { useState, useRef, useCallback, useEffect } from 'react'
import type { TrainingList } from '../types'
import {
  resumeAudioContext,
  getAudioContext,
  decodeAudioBlob,
  playAudioBuffer,
  quickFadeOut,
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
const FADE_SECS = 1.0

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
  const activeGainRef = useRef<GainNode | null>(null)
  const activeBeeps = useRef<Array<{ osc: OscillatorNode; gain: GainNode }>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)
  const listRef = useRef<TrainingList | null>(null)
  const trackIndexRef = useRef(0)

  // Cached decoded buffer so resume/overlap doesn't need to re-fetch IndexedDB
  const cachedBufferRef = useRef<AudioBuffer | null>(null)
  const cachedFileIdRef = useRef<string | null>(null)

  // Pending source: pre-scheduled during rest to fade in before track starts
  const pendingSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const pendingGainRef = useRef<GainNode | null>(null)
  const pendingFileIdRef = useRef<string | null>(null)
  const pendingStartAtRef = useRef<number>(0) // AudioContext time the pending source was scheduled

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

    // Stop any pending pre-scheduled source (fade-in overlap during rest)
    if (pendingSourceRef.current) {
      if (pendingGainRef.current) quickFadeOut(pendingGainRef.current)
      try { pendingSourceRef.current.stop(getAudioContext().currentTime + 0.05) } catch { /* ok */ }
      pendingSourceRef.current = null
      pendingGainRef.current = null
      pendingFileIdRef.current = null
    }

    // Stop active music source
    if (activeSource.current) {
      if (activeGainRef.current) quickFadeOut(activeGainRef.current)
      try { activeSource.current.stop(getAudioContext().currentTime + 0.05) } catch { /* ok */ }
      activeSource.current = null
      activeGainRef.current = null
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

      // Pre-fetch and schedule next track to start FADE_SECS before rest ends
      // (creates an audible fade-in overlap during the last second of rest)
      if (list.restTimeSecs > FADE_SECS + 0.1 && nextTrackIndex < list.tracks.length) {
        const nextTrack = list.tracks[nextTrackIndex]
        const ctx = getAudioContext()
        const fadeInStartAt = ctx.currentTime + list.restTimeSecs - FADE_SECS

        ;(async () => {
          if (!nextTrack || stoppedRef.current) return

          let buf: AudioBuffer
          if (cachedBufferRef.current && cachedFileIdRef.current === nextTrack.fileId) {
            buf = cachedBufferRef.current
          } else {
            const fileRecord = await getAudioFile(nextTrack.fileId)
            if (!fileRecord || stoppedRef.current) return
            buf = await decodeAudioBlob(fileRecord.blob)
            if (stoppedRef.current) return
            cachedBufferRef.current = buf
            cachedFileIdRef.current = nextTrack.fileId
          }

          if (stoppedRef.current) return

          // Clamp start time to now in case decode took too long
          const now = getAudioContext().currentTime
          const startAt = Math.max(now + 0.01, fadeInStartAt)
          const actualFadeIn = Math.max(0, fadeInStartAt + FADE_SECS - startAt)

          // +FADE_SECS: source must cover the early-start overlap so it doesn't end prematurely
          const { source, gain } = playAudioBuffer(
            buf,
            nextTrack.startOffset,
            nextTrack.playDuration + FADE_SECS,
            { startAt, fadeInSecs: actualFadeIn },
          )

          if (stoppedRef.current) {
            quickFadeOut(gain)
            try { source.stop(getAudioContext().currentTime + 0.05) } catch { /* ok */ }
            return
          }

          pendingSourceRef.current = source
          pendingGainRef.current = gain
          pendingFileIdRef.current = nextTrack.fileId
          pendingStartAtRef.current = startAt
        })()
      }
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
      const duration = track.playDuration

      // Check if a pre-scheduled pending source is available for this track
      const canAdoptPending =
        elapsedSecs === 0 &&
        pendingSourceRef.current !== null &&
        pendingFileIdRef.current === track.fileId &&
        cachedBufferRef.current !== null

      let remaining: number

      if (canAdoptPending) {
        // Adopt the pre-started source (already fading in)
        const pendingElapsed = Math.max(
          0,
          getAudioContext().currentTime - pendingStartAtRef.current,
        )
        remaining = Math.max(0.1, duration - pendingElapsed)

        activeSource.current = pendingSourceRef.current!
        activeGainRef.current = pendingGainRef.current!
        pendingSourceRef.current = null
        pendingGainRef.current = null
        pendingFileIdRef.current = null

        // Schedule fade-out on the existing gain node
        if (remaining > FADE_SECS) {
          const now = getAudioContext().currentTime
          activeGainRef.current.gain.setValueAtTime(1, now + remaining - FADE_SECS)
          activeGainRef.current.gain.linearRampToValueAtTime(0, now + remaining)
        }
      } else {
        // Normal path: fetch/decode buffer, then start with fades
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

        const filePosition = track.startOffset + elapsedSecs
        remaining = Math.max(0.1, duration - elapsedSecs)

        const fadeIn = elapsedSecs === 0 ? Math.min(FADE_SECS, remaining / 2) : 0
        const fadeOut = remaining > FADE_SECS ? FADE_SECS : 0

        const { source, gain } = playAudioBuffer(buffer, filePosition, remaining, {
          fadeInSecs: fadeIn,
          fadeOutSecs: fadeOut,
        })
        activeSource.current = source
        activeGainRef.current = gain
      }

      setStatus({
        state: 'playing',
        trackIndex: index,
        totalTracks: list.tracks.length,
        remainingSecs: remaining,
        playDuration: duration,
      })

      // Schedule end beeps that haven't fired yet
      if (list.useBeeps) {
        const effectiveElapsed = canAdoptPending
          ? Math.max(0, getAudioContext().currentTime - pendingStartAtRef.current) // re-read after adopt
          : elapsedSecs
        const endOffsets: number[] = []
        for (let i = 0; i < BEEP_COUNT; i++) {
          const offsetFromNow = duration - BEEP_COUNT + i - effectiveElapsed
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
