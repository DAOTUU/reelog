import { db } from './db'

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export const META_KEYS = {
  lastExportAt: 'lastExportAt',
  installedAt: 'installedAt',
  schemaVersion: 'schemaVersion',
} as const
