import { useState, useEffect, useCallback } from 'react'
import type { TrainingList } from '../types'
import {
  getAllTrainingLists,
  saveTrainingList,
  deleteTrainingList,
} from '../utils/db'

export function useTrainingStore() {
  const [lists, setLists] = useState<TrainingList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllTrainingLists().then((all) => {
      all.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
      setLists(all)
      setLoading(false)
    })
  }, [])

  const save = useCallback(async (list: TrainingList) => {
    await saveTrainingList(list)
    setLists((prev) => {
      const without = prev.filter((l) => l.id !== list.id)
      return [list, ...without].sort((a, b) => b.lastModified.localeCompare(a.lastModified))
    })
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteTrainingList(id)
    setLists((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const getById = useCallback(
    (id: string) => lists.find((l) => l.id === id),
    [lists],
  )

  return { lists, loading, save, remove, getById }
}
