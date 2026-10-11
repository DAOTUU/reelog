import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { WatchlistItem } from '../db/types'

const EMPTY: WatchlistItem[] = []

export function useWatchlist(): WatchlistItem[] {
  return (
    useLiveQuery(async () => {
      const rows = await db.watchlist.orderBy('createdAt').reverse().toArray()
      return rows.filter((r) => !r.deletedAt)
    }, []) ?? EMPTY
  )
}
