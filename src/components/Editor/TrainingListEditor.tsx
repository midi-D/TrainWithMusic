import { useState } from 'react'
import type { TrainingList, Track } from '../../types'

interface Props {
  initial: TrainingList
  onSave: (list: TrainingList) => void
  onSaveAs: (list: TrainingList, newName: string) => void
  onCancel: () => void
}

function newTrack(): Track {
  return {
    id: `track_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    fileId: '',
    fileName: '',
    exerciseTitle: '',
    startOffset: 0,
    playDuration: 30,
  }
}

// Lazy import to avoid circular — TrackRow is heavy with file logic
import { TrackRow } from './TrackRow'

export function TrainingListEditor({ initial, onSave, onSaveAs, onCancel }: Props) {
  const [list, setList] = useState<TrainingList>({ ...initial, tracks: [...initial.tracks] })
  const [saveAsName, setSaveAsName] = useState('')
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [restStr, setRestStr] = useState(String(initial.restTimeSecs))

  const updateTrack = (index: number, track: Track) => {
    setList((l) => {
      const tracks = [...l.tracks]
      tracks[index] = track
      return { ...l, tracks }
    })
  }

  const deleteTrack = (index: number) => {
    setList((l) => ({ ...l, tracks: l.tracks.filter((_, i) => i !== index) }))
  }

  const moveTrack = (from: number, to: number) => {
    setList((l) => {
      const tracks = [...l.tracks]
      const [item] = tracks.splice(from, 1)
      tracks.splice(to, 0, item)
      return { ...l, tracks }
    })
  }

  const handleSave = () => {
    if (!list.name.trim()) return
    onSave({ ...list, lastModified: new Date().toISOString() })
  }

  const handleSaveAs = () => {
    if (!saveAsName.trim()) return
    onSaveAs({ ...list, lastModified: new Date().toISOString() }, saveAsName.trim())
  }

  return (
    <div className="h-dvh flex flex-col bg-gray-950">
      {/* Header */}
      <div className="safe-top sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-xl font-bold leading-none w-8 h-8 flex items-center justify-center"
        >←</button>
        <h1 className="text-white font-bold text-lg flex-1 truncate">
          {initial.id ? 'Edit Training List' : 'New Training List'}
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Name */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Name</span>
          <input
            type="text"
            placeholder="My workout"
            value={list.name}
            onChange={(e) => setList((l) => ({ ...l, name: e.target.value }))}
            className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {/* Rest time + beeps */}
        <div className="flex gap-3">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Rest time (sec)</span>
            <input
              type="text"
              inputMode="numeric"
              value={restStr}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '')
                setRestStr(digits)
                if (digits !== '') setList((l) => ({ ...l, restTimeSecs: Math.max(0, Number(digits)) }))
              }}
              onBlur={() => {
                const val = Math.max(0, Number(restStr) || 0)
                setRestStr(String(val))
                setList((l) => ({ ...l, restTimeSecs: val }))
              }}
              className="w-full bg-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-end gap-2 pb-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={list.useBeeps}
              onChange={(e) => setList((l) => ({ ...l, useBeeps: e.target.checked }))}
              className="w-5 h-5 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-300 whitespace-nowrap">Start/Stop beeps</span>
          </label>
        </div>

        {/* Tracks */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Tracks ({list.tracks.length})
          </span>
          {list.tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              total={list.tracks.length}
              onChange={(t) => updateTrack(i, t)}
              onDelete={() => deleteTrack(i)}
              onMoveUp={() => moveTrack(i, i - 1)}
              onMoveDown={() => moveTrack(i, i + 1)}
            />
          ))}
          <button
            onClick={() => setList((l) => ({ ...l, tracks: [...l.tracks, newTrack()] }))}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400 transition text-sm font-medium"
          >
            + Add Track
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex flex-col gap-2">
        {showSaveAs && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New name…"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
            <button
              onClick={handleSaveAs}
              disabled={!saveAsName.trim()}
              className="bg-blue-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveAs(false)}
              className="text-gray-400 px-2 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setShowSaveAs(true)}
            className="flex-1 py-2.5 rounded-lg bg-gray-700 text-gray-200 text-sm font-medium hover:bg-gray-600 active:scale-[0.98] transition"
          >
            Save as…
          </button>
          <button
            onClick={handleSave}
            disabled={!list.name.trim()}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 disabled:opacity-40 text-white text-sm font-bold hover:bg-blue-500 active:scale-[0.98] transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
