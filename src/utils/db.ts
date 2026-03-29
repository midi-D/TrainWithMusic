import { openDB, type IDBPDatabase } from 'idb'
import type { TrainingList } from '../types'

const DB_NAME = 'TrainWithMusic'
const DB_VERSION = 1

interface AudioFileRecord {
  id: string
  fileName: string
  blob: Blob
}

interface TWMSchema {
  trainingLists: {
    key: string
    value: TrainingList
  }
  audioFiles: {
    key: string
    value: AudioFileRecord
  }
}

let dbPromise: Promise<IDBPDatabase<TWMSchema>> | null = null

function getDB(): Promise<IDBPDatabase<TWMSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TWMSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('trainingLists')) {
          db.createObjectStore('trainingLists', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

// Training Lists
export async function getAllTrainingLists(): Promise<TrainingList[]> {
  const db = await getDB()
  return db.getAll('trainingLists')
}

export async function saveTrainingList(list: TrainingList): Promise<void> {
  const db = await getDB()
  await db.put('trainingLists', list)
}

export async function deleteTrainingList(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('trainingLists', id)
}

export async function getTrainingList(id: string): Promise<TrainingList | undefined> {
  const db = await getDB()
  return db.get('trainingLists', id)
}

// Audio Files
export async function saveAudioFile(id: string, fileName: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await db.put('audioFiles', { id, fileName, blob })
}

export async function getAudioFile(id: string): Promise<AudioFileRecord | undefined> {
  const db = await getDB()
  return db.get('audioFiles', id)
}

export async function deleteAudioFile(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('audioFiles', id)
}
