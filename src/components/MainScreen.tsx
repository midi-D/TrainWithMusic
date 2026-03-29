import type { TrainingList } from '../types'

interface Props {
  lists: TrainingList[]
  loading: boolean
  onNew: () => void
  onEdit: (id: string) => void
  onPlay: (id: string) => void
  onDelete: (id: string) => void
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

export function MainScreen({ lists, loading, onNew, onEdit, onPlay, onDelete }: Props) {
  return (
    <div className="min-h-dvh flex flex-col bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">TrainWithMusic</h1>
          <p className="text-gray-500 text-xs mt-0.5">Your training lists</p>
        </div>
        <button
          onClick={onNew}
          className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-4 py-2 rounded-lg font-semibold text-sm transition"
        >
          + New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="text-gray-500 text-center mt-16">Loading…</div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center gap-4 mt-20 text-center">
            <div className="text-5xl">🎵</div>
            <p className="text-gray-400 text-lg font-medium">No training lists yet</p>
            <p className="text-gray-600 text-sm max-w-xs">
              Tap <strong className="text-gray-400">+ New</strong> to create your first workout.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {lists.map((list) => (
              <div key={list.id} className="bg-gray-800 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-semibold text-base truncate">{list.name}</h2>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {list.tracks.length} track{list.tracks.length !== 1 ? 's' : ''} · {formatDate(list.lastModified)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(list.id)}
                    className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:scale-[0.98] text-gray-200 text-sm font-medium transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onPlay(list.id)}
                    disabled={list.tracks.length === 0}
                    className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 active:scale-[0.98] disabled:opacity-40 text-white text-sm font-bold transition"
                  >
                    ▶ Play
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${list.name}"?`)) onDelete(list.id)
                    }}
                    className="py-2 px-3 rounded-lg bg-gray-700 hover:bg-red-900 active:scale-[0.98] text-gray-400 hover:text-red-300 text-sm transition"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
