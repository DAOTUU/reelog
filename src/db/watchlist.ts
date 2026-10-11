import { newId } from '../lib/id'
import { db } from './db'
import type { NewWatchlistItem, WatchlistItem } from './types'

export async function listWatchlist(): Promise<WatchlistItem[]> {
  const rows = await db.watchlist.orderBy('createdAt').reverse().toArray()
  return rows.filter((r) => !r.deletedAt)
}

export async function createWatchlistItem(
  input: NewWatchlistItem,
): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.watchlist.add({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  return id
}

export async function updateWatchlistItem(
  id: string,
  patch: Partial<NewWatchlistItem>,
): Promise<void> {
  await db.watchlist.update(id, { ...patch, updatedAt: Date.now() })
}

export async function softDeleteWatchlistItem(id: string): Promise<void> {
  const now = Date.now()
  await db.watchlist.update(id, { deletedAt: now, updatedAt: now })
}
