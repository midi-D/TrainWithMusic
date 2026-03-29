import { useRef } from 'react'
import type { Track } from '../../types'
import { saveAudioFile } from '../../utils/db'

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileId = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}`
    await saveAudioFile(fileId, file.name, file)
    onChange({ ...track, fileId, fileName: file.name })
    // reset input so same file can be re-selected
    e.target.value = ''
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
          accept="audio/*"
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
            type="number"
            min={0}
            step={1}
            value={track.startOffset}
            onChange={(e) => onChange({ ...track, startOffset: Math.max(0, Number(e.target.value)) })}
            className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex-1 flex flex-col gap-0.5">
          <span className="text-xs text-gray-500">Play for (sec)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={track.playDuration}
            onChange={(e) => onChange({ ...track, playDuration: Math.max(1, Number(e.target.value)) })}
            className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>
    </div>
  )
}
