import { useRef, useState } from 'react'
import type { Track } from '../../types'
import { saveAudioFile } from '../../utils/db'
import { WaveformEditor } from './WaveformEditor'

interface Props {
  track: Track
  index: number
  total: number
  onChange: (track: Track) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function TrackRow({ track, index, total, onChange, onDelete, onMoveUp, onMoveDown }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local string state so the user can delete all digits without the field snapping back
  const [startStr, setStartStr] = useState(String(track.startOffset))
  const [durationStr, setDurationStr] = useState(String(track.playDuration))
  const [trackLength, setTrackLength] = useState<number | null>(null)

  const clampDuration = (start: number, dur: number, len: number | null): number => {
    const base = Math.max(1, dur)
    if (len === null) return base
    return Math.max(1, Math.min(base, len - start))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileId = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}`
    await saveAudioFile(fileId, file.name, file)
    onChange({ ...track, fileId, fileName: file.name })
    e.target.value = ''
  }

  const handleStartChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    setStartStr(digits)
    if (digits !== '') onChange({ ...track, startOffset: Math.max(0, Number(digits)) })
  }

  const handleStartBlur = () => {
    const val = Math.max(0, Number(startStr) || 0)
    setStartStr(String(val))
    const clampedDur = clampDuration(val, track.playDuration, trackLength)
    if (clampedDur !== track.playDuration) setDurationStr(String(clampedDur))
    onChange({ ...track, startOffset: val, playDuration: clampedDur })
  }

  // Called by the waveform slider — keeps text input in sync too
  const handleStartOffsetChange = (offset: number) => {
    setStartStr(String(offset))
    const clampedDur = clampDuration(offset, track.playDuration, trackLength)
    if (clampedDur !== track.playDuration) setDurationStr(String(clampedDur))
    onChange({ ...track, startOffset: offset, playDuration: clampedDur })
  }

  const handleDurationChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    setDurationStr(digits)
    if (digits !== '') onChange({ ...track, playDuration: Math.max(1, Number(digits)) })
  }

  const handleDurationBlur = () => {
    const raw = Math.max(1, Number(durationStr) || 1)
    const val = clampDuration(track.startOffset, raw, trackLength)
    setDurationStr(String(val))
    onChange({ ...track, playDuration: val })
  }

  const handleDurationKnown = (duration: number) => {
    setTrackLength(duration)
    const clamped = clampDuration(track.startOffset, track.playDuration, duration)
    if (clamped !== track.playDuration) {
      setDurationStr(String(clamped))
      onChange({ ...track, playDuration: clamped })
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
      {/* Row header */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm w-5 shrink-0">{index + 1}.</span>

        {/* File picker */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 min-w-0 text-left text-sm bg-gray-700 hover:bg-gray-600 active:scale-[0.98] rounded px-3 py-1.5 text-gray-200 truncate transition"
        >
          {track.fileName || 'Select audio file…'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.m4a,.wav,.aac,.ogg,.flac,.mp4,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/flac,audio/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Move up/down */}
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="text-gray-400 hover:text-white disabled:opacity-20 px-1 text-lg leading-none"
          title="Move up"
        >↑</button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="text-gray-400 hover:text-white disabled:opacity-20 px-1 text-lg leading-none"
          title="Move down"
        >↓</button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="text-gray-500 hover:text-red-400 px-1 text-lg leading-none"
          title="Remove track"
        >✕</button>
      </div>

      {/* Exercise title */}
      <input
        type="text"
        placeholder="Exercise title (optional)"
        value={track.exerciseTitle}
        onChange={(e) => onChange({ ...track, exerciseTitle: e.target.value })}
        className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Timing */}
      <div className="flex gap-3">
        <label className="flex-1 flex flex-col gap-0.5">
          <span className="text-xs text-gray-500">Start (sec)</span>
          <input
            type="text"
            inputMode="numeric"
            value={startStr}
            onChange={(e) => handleStartChange(e.target.value)}
            onBlur={handleStartBlur}
            className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex-1 flex flex-col gap-0.5">
          <span className="text-xs text-gray-500">Play for (sec)</span>
          <input
            type="text"
            inputMode="numeric"
            value={durationStr}
            onChange={(e) => handleDurationChange(e.target.value)}
            onBlur={handleDurationBlur}
            className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      {/* Waveform + start-position slider + preview */}
      {track.fileId && (
        <WaveformEditor
          fileId={track.fileId}
          startOffset={track.startOffset}
          playDuration={track.playDuration}
          onStartOffsetChange={handleStartOffsetChange}
          onDurationKnown={handleDurationKnown}
        />
      )}
    </div>
  )
}
