import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/db'
import { readStorage, type StorageSnapshot } from '../lib/storage'

export type StorageInfo = StorageSnapshot & {
  records: number
  posters: number
}

const INITIAL: StorageInfo = {
  usage: null,
  quota: null,
  persisted: null,
  records: 0,
  posters: 0,
}

export function useStorageInfo() {
  const [info, setInfo] = useState<StorageInfo>(INITIAL)

  const refresh = useCallback(async () => {
    const snap = await readStorage()
    const rows = await db.records.toArray()
    const records = rows.filter((r) => !r.deletedAt).length
    const posters = await db.posters.count()
    setInfo({ ...snap, records, posters })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { info, refresh }
}
