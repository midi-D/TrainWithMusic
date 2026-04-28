import { useState } from 'react'
import type { Screen, TrainingList, AppSettings } from './types'
import { useTrainingStore } from './hooks/useTrainingStore'
import { useAppSettings, ThemeContext } from './hooks/useAppSettings'
import { MainScreen } from './components/MainScreen'
import { InfoScreen } from './components/InfoScreen'
import { TrainingListEditor } from './components/Editor/TrainingListEditor'
import { PlaybackScreen } from './components/Playback/PlaybackScreen'

function newList(settings: AppSettings): TrainingList {
  return {
    id: `list_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: '',
    tracks: [],
    restTimeSecs: settings.defaultRestTimeSecs,
    useBeeps: settings.defaultUseBeeps,
    lastModified: new Date().toISOString(),
  }
}

export default function App() {
  const { lists, loading, save, remove, getById } = useTrainingStore()
  const { settings, updateSettings } = useAppSettings()
  const [screen, setScreen] = useState<Screen>({ type: 'main' })
  const [editTarget, setEditTarget] = useState<TrainingList | null>(null)

  const openNew = () => {
    setEditTarget(newList(settings))
    setScreen({ type: 'editor', listId: null })
  }

  const openEdit = (id: string) => {
    const list = getById(id)
    if (!list) return
    setEditTarget({ ...list, tracks: list.tracks.map((t) => ({ ...t })) })
    setScreen({ type: 'editor', listId: id })
  }

  const handleSave = async (list: TrainingList) => {
    await save(list)
    setScreen({ type: 'main' })
  }

  const handleSaveAs = async (list: TrainingList, newName: string) => {
    const copy: TrainingList = {
      ...list,
      id: `list_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: newName,
      lastModified: new Date().toISOString(),
    }
    await save(copy)
    setScreen({ type: 'main' })
  }

  if (screen.type === 'info') {
    return (
      <ThemeContext.Provider value={settings.theme}>
        <InfoScreen section={screen.section} onBack={() => setScreen({ type: 'main' })} />
      </ThemeContext.Provider>
    )
  }

  if (screen.type === 'editor' && editTarget) {
    return (
      <ThemeContext.Provider value={settings.theme}>
        <TrainingListEditor
          initial={editTarget}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onCancel={() => setScreen({ type: 'main' })}
        />
      </ThemeContext.Provider>
    )
  }

  if (screen.type === 'playback') {
    const list = getById(screen.listId)
    if (list) {
      return (
        <ThemeContext.Provider value={settings.theme}>
          <PlaybackScreen
            list={list}
            onExit={() => setScreen({ type: 'main' })}
          />
        </ThemeContext.Provider>
      )
    }
  }

  return (
    <ThemeContext.Provider value={settings.theme}>
      <MainScreen
        lists={lists}
        loading={loading}
        settings={settings}
        onNew={openNew}
        onEdit={openEdit}
        onPlay={(id) => setScreen({ type: 'playback', listId: id })}
        onDelete={remove}
        onInfoSelect={(section) => setScreen({ type: 'info', section })}
        onSettingsChange={updateSettings}
      />
    </ThemeContext.Provider>
  )
}
