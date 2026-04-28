import { useState } from 'react'
import type { TrainingList, InfoSection, AppSettings } from '../types'
import { resumeAudioContext } from '../utils/audio'
import { SettingsPanel } from './SettingsPanel'

interface Props {
  lists: TrainingList[]
  loading: boolean
  settings: AppSettings
  onNew: () => void
  onEdit: (id: string) => void
  onPlay: (id: string) => void
  onDelete: (id: string) => void
  onInfoSelect: (section: InfoSection) => void
  onSettingsChange: (patch: Partial<AppSettings>) => void
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  } catch {
    return ''
  }
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

export function MainScreen({ lists, loading, settings, onNew, onEdit, onPlay, onDelete, onInfoSelect, onSettingsChange }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="h-dvh flex flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="safe-top bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white text-xl font-bold">TrainWithMusic</h1>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">Your training lists</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 active:scale-95 transition"
            aria-label="Settings"
          >
            <GearIcon />
          </button>
          <button
            onClick={onNew}
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-4 py-2 rounded-lg font-semibold text-sm transition"
          >
            + New
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="text-gray-400 dark:text-gray-500 text-center mt-16">Loading…</div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center gap-4 mt-20 text-center">
            <div className="text-5xl">🎵</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No training lists yet</p>
            <p className="text-gray-400 dark:text-gray-600 text-sm max-w-xs">
              Tap <strong className="text-gray-600 dark:text-gray-400">+ New</strong> to create your first workout.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lists.map((list) => (
              <div key={list.id} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-gray-900 dark:text-white font-semibold text-base truncate">{list.name}</h2>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
                      {list.tracks.length} track{list.tracks.length !== 1 ? 's' : ''} · {formatDate(list.lastModified)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(list.id)}
                    className="flex-1 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-[0.98] text-gray-700 dark:text-gray-200 text-sm font-medium transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { resumeAudioContext(); onPlay(list.id) }}
                    disabled={list.tracks.length === 0}
                    className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 active:scale-[0.98] disabled:opacity-40 text-white text-sm font-bold transition"
                  >
                    ▶ Play
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${list.name}"?`)) onDelete(list.id)
                    }}
                    className="py-2 px-3 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900 active:scale-[0.98] text-gray-400 hover:text-red-500 dark:hover:text-red-300 text-sm transition"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings overlay */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          onInfoSelect={onInfoSelect}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
