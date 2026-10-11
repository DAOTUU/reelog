import { db } from '../db/db'
import type { Backup } from '../db/types'
import { newId } from '../lib/id'

/** 库内最多保留几份快照。再多意义不大，还会挤占存储配额。 */
export const KEEP_BACKUPS = 3

export async function saveBackup(input: {
  kind: Backup['kind']
  label: string
  blob: Blob
  recordCount: number
  posterCount: number
}): Promise<string> {
  const id = newId()
  await db.backups.put({
    id,
    kind: input.kind,
    label: input.label,
    blob: input.blob,
    recordCount: input.recordCount,
    posterCount: input.posterCount,
    createdAt: Date.now(),
  })
  await pruneBackups()
  return id
}

export async function listBackups(): Promise<Backup[]> {
  const rows = await db.backups.toArray()
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getBackup(id: string): Promise<Backup | undefined> {
  return db.backups.get(id)
}

export async function deleteBackup(id: string): Promise<void> {
  await db.backups.delete(id)
}

/** 超出保留数量的旧快照按时间淘汰 */
export async function pruneBackups(keep = KEEP_BACKUPS): Promise<void> {
  const rows = await db.backups.toArray()
  if (rows.length <= keep) return
  const doomed = rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(keep)
  await db.backups.bulkDelete(doomed.map((b) => b.id))
}

/** 快照占用的字节数，用于在设置页展示 */
export async function backupBytes(): Promise<number> {
  const rows = await db.backups.toArray()
  return rows.reduce((n, b) => n + b.blob.size, 0)
}
