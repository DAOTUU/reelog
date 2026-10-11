import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { WatchRecord } from '../db/types'

const EMPTY: WatchRecord[] = []

/**
 * 未删除的观影记录，按观影日期倒序。
 * 用 useLiveQuery，任何写入都会自动触发重新渲染，不需要手动刷新。
 */
export function useRecords(): WatchRecord[] {
  return (
    useLiveQuery(async () => {
      const rows = await db.records.orderBy('watchedOn').reverse().toArray()
      return rows.filter((r) => !r.deletedAt)
    }, []) ?? EMPTY
  )
}
