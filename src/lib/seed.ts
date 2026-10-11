import { db } from '../db/db'
import type { WatchRecord } from '../db/types'
import { dataUriToBlob } from './dataUri'
import { newId } from './id'
import { PREVIEW_RECORDS } from './mock'

/**
 * 开发/试用用的示例数据。
 *
 * ⚠️ 这是**纯开发环境**的东西：设置页那个入口用 import.meta.env.DEV 守着，
 * 正式构建里整段是死代码，连同下面依赖的 mock.ts（那里面塞着一堆内联的
 * base64 海报）一起会被摇掉，不会进生产包。
 *
 * 它存在的意义是让空库也能看到真实数据的排布效果——
 * 不然调界面时每次都要先手录十几条带海报的记录。
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

/**
 * 库里现有的数据量。
 *
 * 给「清空全部数据」的二次确认用：光问一句「确定吗」没有意义，
 * 把**具体要删掉多少东西**摆出来，人才会真的看一眼。
 */
export async function dataCounts(): Promise<{
  records: number
  posters: number
}> {
  const [records, posters] = await Promise.all([
    db.records.count(),
    db.posters.count(),
  ])
  return { records, posters }
}
