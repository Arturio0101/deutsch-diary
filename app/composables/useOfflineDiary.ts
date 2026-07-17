import {
  openDB,
  type DBSchema,
  type IDBPDatabase
} from 'idb'

export type OfflineLanguageLevel =
  | 'B1'
  | 'B2'
  | 'C1'

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

interface DeutschDiaryDatabase
  extends DBSchema {
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
      'by-status':
        PendingDiaryEntry['status']
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
  | Promise<
      IDBPDatabase<DeutschDiaryDatabase>
    >
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
    databasePromise =
      openDB<DeutschDiaryDatabase>(
        DATABASE_NAME,
        DATABASE_VERSION,
        {
          upgrade(database) {
            if (
              !database.objectStoreNames.contains(
                'drafts'
              )
            ) {
              const store =
                database.createObjectStore(
                  'drafts',
                  {
                    keyPath: 'id'
                  }
                )

              store.createIndex(
                'by-user',
                'userId'
              )
            }

            if (
              !database.objectStoreNames.contains(
                'pendingEntries'
              )
            ) {
              const store =
                database.createObjectStore(
                  'pendingEntries',
                  {
                    keyPath: 'id'
                  }
                )

              store.createIndex(
                'by-user',
                'userId'
              )

              store.createIndex(
                'by-status',
                'status'
              )

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
              const store =
                database.createObjectStore(
                  'cachedEntries',
                  {
                    keyPath: 'id'
                  }
                )

              store.createIndex(
                'by-user',
                'userId'
              )

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
              const store =
                database.createObjectStore(
                  'cachedVocabulary',
                  {
                    keyPath: 'id'
                  }
                )

              store.createIndex(
                'by-user',
                'userId'
              )

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
  draft: Omit<
    OfflineDiaryDraft,
    'id' | 'updatedAt'
  >
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

export async function queueOfflineDiaryEntry(
  entry: {
    userId: string
    entryDate: string
    originalText: string
    languageLevel: OfflineLanguageLevel
    correctionMode: OfflineCorrectionMode
  }
) {
  if (!import.meta.client) {
    throw new Error(
      'Offline-Einträge können nur im Browser gespeichert werden.'
    )
  }

  const database = await getDatabase()
  const now = new Date().toISOString()

  const pendingEntry: PendingDiaryEntry = {
    id: crypto.randomUUID(),
    userId: entry.userId,
    entryDate: entry.entryDate,
    originalText: entry.originalText,
    languageLevel: entry.languageLevel,
    correctionMode:
      entry.correctionMode,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  }

  await database.put(
    'pendingEntries',
    pendingEntry
  )

  return pendingEntry
}

export async function getPendingDiaryEntries(
  userId: string
) {
  if (!import.meta.client) {
    return []
  }

  const database = await getDatabase()

  const entries =
    await database.getAllFromIndex(
      'pendingEntries',
      'by-user',
      userId
    )

  return entries.sort(
    (first, second) =>
      first.createdAt.localeCompare(
        second.createdAt
      )
  )
}

export async function updatePendingDiaryEntry(
  id: string,
  changes: Partial<
    Pick<
      PendingDiaryEntry,
      'status' | 'errorMessage'
    >
  >
) {
  if (!import.meta.client) {
    return null
  }

  const database = await getDatabase()

  const currentEntry = await database.get(
    'pendingEntries',
    id
  )

  if (!currentEntry) {
    return null
  }

  const updatedEntry: PendingDiaryEntry = {
    ...currentEntry,
    ...changes,
    id: currentEntry.id,
    userId: currentEntry.userId,
    updatedAt: new Date().toISOString()
  }

  if (!updatedEntry.errorMessage) {
    delete updatedEntry.errorMessage
  }

  await database.put(
    'pendingEntries',
    updatedEntry
  )

  return updatedEntry
}

export async function deletePendingDiaryEntry(
  id: string
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  await database.delete(
    'pendingEntries',
    id
  )
}

export async function countPendingDiaryEntries(
  userId: string
) {
  if (!import.meta.client) {
    return 0
  }

  const entries =
    await getPendingDiaryEntries(userId)

  return entries.length
}

export async function replaceCachedDiaryEntries<
  T extends {
    id: string
    entry_date: string
  }
>(
  userId: string,
  entries: T[]
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  const existingEntries =
    await database.getAllFromIndex(
      'cachedEntries',
      'by-user',
      userId
    )

  const transaction = database.transaction(
    'cachedEntries',
    'readwrite'
  )

  for (const existingEntry of existingEntries) {
    transaction.store.delete(existingEntry.id)
  }

  for (const entry of entries) {
    transaction.store.put({
      id: entry.id,
      userId,
      entryDate: entry.entry_date,
      data: entry,
      updatedAt: new Date().toISOString()
    })
  }

  await transaction.done
}

export async function saveCachedDiaryEntry<
  T extends {
    id: string
    entry_date: string
  }
>(
  userId: string,
  entry: T
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  await database.put('cachedEntries', {
    id: entry.id,
    userId,
    entryDate: entry.entry_date,
    data: entry,
    updatedAt: new Date().toISOString()
  })
}

export async function loadCachedDiaryEntries<T>(
  userId: string
) {
  if (!import.meta.client) {
    return [] as T[]
  }

  const database = await getDatabase()

  const cachedEntries =
    await database.getAllFromIndex(
      'cachedEntries',
      'by-user',
      userId
    )

  return cachedEntries.map(
    (cachedEntry) =>
      cachedEntry.data as T
  )
}

export async function loadCachedDiaryEntry<T>(
  userId: string,
  entryId: string
) {
  if (!import.meta.client) {
    return null
  }

  const database = await getDatabase()

  const cachedEntry = await database.get(
    'cachedEntries',
    entryId
  )

  if (
    !cachedEntry ||
    cachedEntry.userId !== userId
  ) {
    return null
  }

  return cachedEntry.data as T
}

export async function deleteCachedDiaryEntry(
  userId: string,
  entryId: string
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  const cachedEntry = await database.get(
    'cachedEntries',
    entryId
  )

  if (
    cachedEntry &&
    cachedEntry.userId === userId
  ) {
    await database.delete(
      'cachedEntries',
      entryId
    )
  }
}

export async function replaceCachedVocabularyItems<
  T extends {
    id: string
    last_seen_at: string
  }
>(
  userId: string,
  items: T[]
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  const existingItems =
    await database.getAllFromIndex(
      'cachedVocabulary',
      'by-user',
      userId
    )

  const transaction = database.transaction(
    'cachedVocabulary',
    'readwrite'
  )

  for (const existingItem of existingItems) {
    transaction.store.delete(existingItem.id)
  }

  for (const item of items) {
    transaction.store.put({
      id: item.id,
      userId,
      data: item,
      lastSeenAt: item.last_seen_at
    })
  }

  await transaction.done
}

export async function loadCachedVocabularyItems<T>(
  userId: string
) {
  if (!import.meta.client) {
    return [] as T[]
  }

  const database = await getDatabase()

  const cachedItems =
    await database.getAllFromIndex(
      'cachedVocabulary',
      'by-user',
      userId
    )

  return cachedItems.map(
    (cachedItem) =>
      cachedItem.data as T
  )
}

export async function deleteCachedVocabularyItem(
  userId: string,
  itemId: string
) {
  if (!import.meta.client) {
    return
  }

  const database = await getDatabase()

  const cachedItem = await database.get(
    'cachedVocabulary',
    itemId
  )

  if (
    cachedItem &&
    cachedItem.userId === userId
  ) {
    await database.delete(
      'cachedVocabulary',
      itemId
    )
  }
}