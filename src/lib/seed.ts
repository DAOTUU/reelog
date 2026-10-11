import { db } from '../db/db'
import type { WatchRecord } from '../db/types'
import { dataUriToBlob } from './dataUri'
import { newId } from './id'
import { PREVIEW_RECORDS } from './mock'

/**
 * 开发/试用用的示例数据。
 *
 * ⚠️ 正式发布前应该删掉这个模块和设置页里的入口——
 * 它只是为了让空库也能看到真实数据的排布效果。
 */
export async function seedSampleData(): Promise<number> {
  const now = Date.now()
  const records: WatchRecord[] = []
  const posters: {
    key: string
    blob: Blob
    mimeType: string
    width: number
    height: number
    createdAt: number
  }[] = []

  PREVIEW_RECORDS.forEach((p, i) => {
    const id = newId()
    const blob = dataUriToBlob(p.poster)
    // 海报与记录一对一，用同一条 id 当主键
    records.push({
      id,
      tmdbId: null,
      title: p.title,
      originalTitle: p.originalTitle,
      year: p.year,
      posterKey: id,
      watchedOn: p.watchedOn,
      cinema: p.cinema,
      hallFormat: p.hallFormat,
      versionType: p.versionType,
      rating: p.rating,
      review: p.review,
      rewatchCount: p.rewatchCount,
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
      deletedAt: null,
    })
    posters.push({
      key: id,
      blob,
      mimeType: blob.type,
      width: 0,
      height: 0,
      createdAt: now,
    })
  })

  await db.transaction('rw', db.records, db.posters, async () => {
    await db.records.bulkPut(records)
    await db.posters.bulkPut(posters)
  })

  return records.length
}

/** 清空观影数据。meta 保留（里面的 lastExportAt 等不属于用户数据）。 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.records, db.watchlist, db.posters, async () => {
    await db.records.clear()
    await db.watchlist.clear()
    await db.posters.clear()
  })
}
