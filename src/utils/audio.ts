let audioCtx: AudioContext | null = null

// Called by native iOS (AppDelegate) via JS injection after AirPlay/route changes
;(window as any).__resumeAudioContext = () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
}

function setupAudioContextRecovery(ctx: AudioContext) {
  ctx.onstatechange = () => {
    if (ctx.state === 'suspended') {
      // Small delay avoids fighting with the system during active route transitions
      setTimeout(() => {
        ctx.resume().catch(() => {})
      }, 200)
    }
  }
}

export function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
    setupAudioContextRecovery(audioCtx)
  }
  return audioCtx
}

export async function resumeAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}

export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext()
  const arrayBuffer = await blob.arrayBuffer()
  return ctx.decodeAudioData(arrayBuffer)
}

export interface PlayingTrack {
  source: AudioBufferSourceNode
  beepNodes: Array<{ osc: OscillatorNode; gain: GainNode }>
}

/**
 * Start playing an AudioBuffer from `startOffset` seconds for `playDuration` seconds.
 * Optional fade-in/fade-out via a GainNode, and an optional `startAt` AudioContext time.
 * Returns both the source and gain node so the caller can manage them.
 */
export function playAudioBuffer(
  buffer: AudioBuffer,
  startOffset: number,
  playDuration: number,
  options: { fadeInSecs?: number; fadeOutSecs?: number; startAt?: number } = {},
): { source: AudioBufferSourceNode; gain: GainNode } {
  const { fadeInSecs = 0, fadeOutSecs = 0, startAt } = options
  const ctx = getAudioContext()
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = buffer
  source.connect(gain)
  gain.connect(ctx.destination)

  const scheduleAt = startAt ?? ctx.currentTime

  if (fadeInSecs > 0) {
    gain.gain.setValueAtTime(0, scheduleAt)
    gain.gain.linearRampToValueAtTime(1, scheduleAt + fadeInSecs)
  }
  if (fadeOutSecs > 0 && playDuration > fadeOutSecs) {
    gain.gain.setValueAtTime(1, scheduleAt + playDuration - fadeOutSecs)
    gain.gain.linearRampToValueAtTime(0, scheduleAt + playDuration)
  }

  source.start(scheduleAt, startOffset, playDuration)
  return { source, gain }
}

/**
 * Ramp a GainNode to silence over 50ms — call before stopping a source early to avoid clicks.
 */
export function quickFadeOut(gain: GainNode): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0, now + 0.05)
}

/**
 * Schedule beeps at specific times relative to now.
 * Each beep is a short 880 Hz tone for 0.25s.
 */
export function scheduleBeeps(offsetsFromNow: number[]): Array<{ osc: OscillatorNode; gain: GainNode }> {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  return offsetsFromNow.map((offset) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.6, now + offset)
    gain.gain.linearRampToValueAtTime(0, now + offset + 0.22) // ramp down to avoid click
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + offset)
    osc.stop(now + offset + 0.25)
    return { osc, gain }
  })
}

export function stopNodes(nodes: Array<{ osc: OscillatorNode; gain: GainNode }>): void {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  for (const { osc, gain } of nodes) {
    try {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(0, now)
      osc.stop(now)
    } catch {
      // already stopped
    }
  }
}

let applauseBuffer: AudioBuffer | null = null

export async function loadApplause(): Promise<void> {
  try {
    const resp = await fetch('./Finishing.m4a')
    const arrayBuffer = await resp.arrayBuffer()
    const ctx = getAudioContext()
    applauseBuffer = await ctx.decodeAudioData(arrayBuffer)
  } catch {
    // finishing sound not critical
  }
}

export function playApplause(): void {
  if (!applauseBuffer) return
  playAudioBuffer(applauseBuffer, 0, applauseBuffer.duration, {
    fadeInSecs: 0.5,
    fadeOutSecs: 0.5,
  })
}
