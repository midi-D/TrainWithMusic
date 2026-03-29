import { useEffect, useRef, useState, useCallback } from 'react'
import { getAudioFile } from '../../utils/db'
import { getAudioContext, resumeAudioContext } from '../../utils/audio'

interface Props {
  fileId: string
  startOffset: number
  playDuration: number
  onStartOffsetChange: (offset: number) => void
}

const NUM_BARS = 200

function formatDur(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function WaveformEditor({ fileId, startOffset, playDuration, onStartOffsetChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioBufRef = useRef<AudioBuffer | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)

  const [waveform, setWaveform] = useState<Float32Array | null>(null)
  const [totalDuration, setTotalDuration] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)

  // Load + decode audio and generate waveform bars whenever fileId changes
  useEffect(() => {
    if (!fileId) return
    let cancelled = false
    setLoading(true)
    setWaveform(null)
    setTotalDuration(null)
    audioBufRef.current = null

    ;(async () => {
      try {
        const record = await getAudioFile(fileId)
        if (!record || cancelled) return

        const ctx = getAudioContext()
        const arrayBuffer = await record.blob.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return

        audioBufRef.current = audioBuffer
        const duration = audioBuffer.duration
        setTotalDuration(duration)

        // Downsample channel 0 to NUM_BARS RMS values
        const channelData = audioBuffer.getChannelData(0)
        const blockSize = Math.max(1, Math.floor(channelData.length / NUM_BARS))
        const bars = new Float32Array(NUM_BARS)
        for (let i = 0; i < NUM_BARS; i++) {
          let sum = 0
          for (let j = 0; j < blockSize; j++) {
            const s = channelData[i * blockSize + j] ?? 0
            sum += s * s
          }
          bars[i] = Math.sqrt(sum / blockSize)
        }
        // Normalize to [0, 1]
        const max = Math.max(...bars, 0.0001)
        for (let i = 0; i < bars.length; i++) bars[i] /= max

        setWaveform(bars)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [fileId])

  // Redraw canvas whenever waveform data or position/duration changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveform || totalDuration === null) return

    const dpr = window.devicePixelRatio || 1
    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    if (displayW === 0 || displayH === 0) return

    canvas.width = displayW * dpr
    canvas.height = displayH * dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, displayW, displayH)

    const barW = displayW / NUM_BARS
    const startFrac = startOffset / totalDuration
    const endFrac = Math.min(1, (startOffset + playDuration) / totalDuration)

    for (let i = 0; i < NUM_BARS; i++) {
      const frac = i / NUM_BARS
      const barH = Math.max(2, waveform[i] * displayH * 0.88)
      const x = i * barW
      const y = (displayH - barH) / 2

      if (frac >= startFrac && frac < endFrac) {
        ctx.fillStyle = '#4ade80' // green-400
      } else {
        ctx.fillStyle = '#1f2937' // gray-800
      }
      ctx.fillRect(x, y, Math.max(1, barW - 0.8), barH)
    }

    // White marker line at start position
    const markerX = Math.round(startFrac * displayW)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(markerX - 1, 0, 2, displayH)
  }, [waveform, totalDuration, startOffset, playDuration])

  // Preview: play 10 s centred around middle of track
  const handlePreview = useCallback(async () => {
    // Stop existing preview
    if (previewSourceRef.current) {
      try { previewSourceRef.current.stop() } catch { /* ok */ }
      previewSourceRef.current = null
      setIsPreviewing(false)
      return
    }
    if (!audioBufRef.current) return

    await resumeAudioContext()
    const ctx = getAudioContext()
    const previewStart = startOffset
    const previewLen = playDuration

    const source = ctx.createBufferSource()
    source.buffer = audioBufRef.current
    source.connect(ctx.destination)
    source.start(0, previewStart, previewLen)
    previewSourceRef.current = source
    setIsPreviewing(true)
    source.onended = () => {
      previewSourceRef.current = null
      setIsPreviewing(false)
    }
  }, [startOffset, playDuration])

  // Stop preview when component unmounts
  useEffect(() => {
    return () => {
      if (previewSourceRef.current) {
        try { previewSourceRef.current.stop() } catch { /* ok */ }
      }
    }
  }, [])

  if (!fileId) return null

  const maxStart = totalDuration !== null
    ? Math.max(0, Math.floor(totalDuration) - playDuration)
    : 0
  const clampedStart = Math.min(startOffset, maxStart)

  return (
    <div className="flex flex-col gap-2 pt-1">
      {loading && (
        <div className="h-16 flex items-center justify-center bg-gray-900 rounded text-gray-600 text-xs">
          Loading waveform…
        </div>
      )}

      {waveform && totalDuration !== null && (
        <>
          {/* Waveform */}
          <div className="relative w-full rounded overflow-hidden bg-gray-900" style={{ height: '4rem' }}>
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>

          {/* Slider */}
          <input
            type="range"
            min={0}
            max={maxStart}
            step={1}
            value={clampedStart}
            onChange={(e) => onStartOffsetChange(Number(e.target.value))}
            className="w-full accent-green-400"
          />

          {/* Info + preview */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500 shrink-0">
              Start: {clampedStart}s &nbsp;/&nbsp; Total: {formatDur(totalDuration)}
            </span>
            <button
              onClick={handlePreview}
              className={`shrink-0 px-3 py-1 rounded text-xs font-medium transition ${
                isPreviewing
                  ? 'bg-yellow-800 text-yellow-300'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
              }`}
            >
              {isPreviewing ? '■ Stop' : '▶ Preview selection'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
