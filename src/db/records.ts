import { newId } from '../lib/id'
import { db } from './db'
import type { NewRecord, WatchRecord } from './types'

/** 未删除的记录，按观影日期倒序。软删过滤在 JS 里做——原因见 db.ts 的注释。 */
export async function listRecords(): Promise<WatchRecord[]> {
  const rows = await db.records.orderBy('watchedOn').reverse().toArray()
  return rows.filter((r) => !r.deletedAt)
}

export async function getRecord(id: string): Promise<WatchRecord | undefined> {
  const row = await db.records.get(id)
  return row && !row.deletedAt ? row : undefined
}

export async function createRecord(input: NewRecord): Promise<string> {
  const now = Date.now()
  const id = newId()
  await db.records.add({
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  return id
}

export async function updateRecord(
  id: string,
  patch: Partial<NewRecord>,
): Promise<void> {
  // updatedAt 必须一并更新，否则导入合并时会被别的设备的旧版本盖掉
  await db.records.update(id, { ...patch, updatedAt: Date.now() })
}

export async function softDeleteRecord(id: string): Promise<void> {
  const now = Date.now()
  await db.records.update(id, { deletedAt: now, updatedAt: now })
}

export async function restoreRecord(id: string): Promise<void> {
  await db.records.update(id, { deletedAt: null, updatedAt: Date.now() })
}

/** 影院的自动补全池：从已有记录里取，配合输入框做补全 */
export async function knownCinemas(): Promise<string[]> {
  const rows = await db.records.toArray()
  const set = new Set<string>()
  for (const r of rows) {
    const c = r.cinema.trim()
    if (c) set.add(c)
  }
  return [...set].sort()
}
