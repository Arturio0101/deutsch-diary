import {
  openDB,
  type DBSchema,
  type IDBPDatabase
} from 'idb'

export type OfflineLanguageLevel = 'B1' | 'B2' | 'C1'

export type OfflineCorrectionMode =
  | 'minimal'
  | 'natural'
  | 'level-adjusted'

export interface OfflineDiaryDraft {
  id: string
  userId: string
  text: string
  languageLevel: OfflineLanguageLevel
  correctionMode: OfflineCorrectionMode
  updatedAt: string
}

export interface PendingDiaryEntry {
  id: string
  userId: string
  entryDate: string
  originalText: string
  languageLevel: OfflineLanguageLevel
  correctionMode: OfflineCorrectionMode
  status: 'pending' | 'syncing' | 'failed'
  createdAt: string
  updatedAt: string
  errorMessage?: string
}

export interface CachedDiaryEntry {
  id: string
  userId: string
  entryDate: string
  data: Record<string, unknown>
  updatedAt: string
}

export interface CachedVocabularyItem {
  id: string
  userId: string
  data: Record<string, unknown>
  lastSeenAt: string
}

interface DeutschDiaryDatabase extends DBSchema {
  drafts: {
    key: string
    value: OfflineDiaryDraft
    indexes: {
      'by-user': string
    }
  }

  pendingEntries: {
    key: string
    value: PendingDiaryEntry
    indexes: {
      'by-user': string
      'by-status': PendingDiaryEntry['status']
      'by-created-at': string
    }
  }

  cachedEntries: {
    key: string
    value: CachedDiaryEntry
    indexes: {
      'by-user': string
      'by-entry-date': string
    }
  }

  cachedVocabulary: {
    key: string
    value: CachedVocabularyItem
    indexes: {
      'by-user': string
      'by-last-seen': string
    }
  }
}

const DATABASE_NAME = 'deutsch-diary'
const DATABASE_VERSION = 1

let databasePromise:
  | Promise<IDBPDatabase<DeutschDiaryDatabase>>
  | null = null

function createDraftId(userId: string) {
  return `draft:${userId}`
}

function getDatabase() {
  if (!import.meta.client) {
    throw new Error(
      'Die Offline-Datenbank ist nur im Browser verfügbar.'
    )
  }

  if (!databasePromise) {
    databasePromise = openDB<DeutschDiaryDatabase>(
      DATABASE_NAME,
      DATABASE_VERSION,
      {
        upgrade(database) {
          if (!database.objectStoreNames.contains('drafts')) {
            const store = database.createObjectStore(
              'drafts',
              {
                keyPath: 'id'
              }
            )

            store.createIndex('by-user', 'userId')
          }

          if (
            !database.objectStoreNames.contains(
              'pendingEntries'
            )
          ) {
            const store = database.createObjectStore(
              'pendingEntries',
              {
                keyPath: 'id'
              }
            )

            store.createIndex('by-user', 'userId')
            store.createIndex('by-status', 'status')
            store.createIndex(
              'by-created-at',
              'createdAt'
            )
          }

          if (
            !database.objectStoreNames.contains(
              'cachedEntries'
            )
          ) {
            const store = database.createObjectStore(
              'cachedEntries',
              {
                keyPath: 'id'
              }
            )

            store.createIndex('by-user', 'userId')
            store.createIndex(
              'by-entry-date',
              'entryDate'
            )
          }

          if (
            !database.objectStoreNames.contains(
              'cachedVocabulary'
            )
          ) {
            const store = database.createObjectStore(
              'cachedVocabulary',
              {
                keyPath: 'id'
              }
            )

            store.createIndex('by-user', 'userId')
            store.createIndex(
              'by-last-seen',
              'lastSeenAt'
            )
          }
        }
      }
    )
  }

  return databasePromise
}

export async function loadOfflineDraft(
  userId: string
) {
  if (!import.meta.client) {
    return null
  }

  const database = await getDatabase()

  return (
    (await database.get(
      'drafts',
      createDraftId(userId)
    )) ?? null
  )
}

export async function saveOfflineDraft(
  draft: Omit<OfflineDiaryDraft, 'id' | 'updatedAt'>
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()
  const id = createDraftId(draft.userId)

  if (!draft.text.trim()) {
    await database.delete('drafts', id)
    return
  }

  await database.put('drafts', {
    ...draft,
    id,
    updatedAt: new Date().toISOString()
  })
}

export async function deleteOfflineDraft(
  userId: string
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  await database.delete(
    'drafts',
    createDraftId(userId)
  )
}