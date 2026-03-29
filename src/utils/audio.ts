let audioCtx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
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
 * Returns handles so the caller can stop them early.
 */
export function playAudioBuffer(
  buffer: AudioBuffer,
  startOffset: number,
  playDuration: number,
): AudioBufferSourceNode {
  const ctx = getAudioContext()
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(ctx.currentTime, startOffset, playDuration)
  return source
}

/**
 * Schedule beeps at specific times relative to now.
 * Each beep is a short 800 Hz tone for 0.25s.
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
    const resp = await fetch('./applause.wav')
    const arrayBuffer = await resp.arrayBuffer()
    const ctx = getAudioContext()
    applauseBuffer = await ctx.decodeAudioData(arrayBuffer)
  } catch {
    // applause file not critical
  }
}

export function playApplause(): void {
  if (!applauseBuffer) return
  const ctx = getAudioContext()
  const source = ctx.createBufferSource()
  source.buffer = applauseBuffer
  source.connect(ctx.destination)
  source.start()
}
