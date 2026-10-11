import { unzip, type Unzipped } from 'fflate'
import { db } from '../db/db'
import type { Poster, WatchRecord, WatchlistItem } from '../db/types'
import {
  applyMerge,
  findPotentialDuplicates,
  mergeCollections,
  type MergeStats,
} from './merge'
import {
  BACKUP_VERSION,
  isBackupFile,
  type BackupFile,
} from './schema'

export type ParsedBackup = {
  backup: BackupFile
  posterBlobs: Map<string, Blob>
}

export type ImportPreview = {
  parsed: ParsedBackup
  recordStats: MergeStats
  watchlistStats: MergeStats
  /** 本地没有、将会新增的海报张数 */
  newPosters: number
  /** 备份包里引用了、但 zip 里找不到对应文件的图 */
  missingPosters: number
  /** 合并后疑似重复的记录组（只提示，不自动处理） */
  duplicates: WatchRecord[][]
}

export async function parseBackupZip(input: Blob): Promise<ParsedBackup> {
  const bytes = new Uint8Array(await input.arrayBuffer())

  const files = await new Promise<Unzipped>((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)))
  })

  const rawJson = files['data.json']
  if (!rawJson) {
    throw new Error('这个 zip 里没有 data.json —— 可能不是 Reelog 的备份文件。')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(rawJson))
  } catch {
    throw new Error('data.json 解析失败，文件可能已损坏。')
  }

  if (!isBackupFile(parsed)) {
    throw new Error('文件格式不匹配，可能不是 Reelog 的备份文件。')
  }

  if (parsed.version > BACKUP_VERSION) {
    throw new Error(
      `这份备份的版本（v${parsed.version}）比当前应用支持的（v${BACKUP_VERSION}）更新，请先升级应用再导入。`,
    )
  }

  const posterBlobs = new Map<string, Blob>()
  for (const entry of parsed.posters) {
    const raw = files[entry.file]
    if (raw) {
      posterBlobs.set(
        entry.key,
        new Blob([raw as unknown as BlobPart], { type: entry.mimeType }),
      )
    }
  }

  return { backup: parsed, posterBlobs }
}

/**
 * 只算不写。
 *
 * 导入是个破坏性操作，所以在动数据库之前先把结果摊开给用户看：
 * 会新增几条、覆盖几条、有没有疑似重复。用户点了确认才真的写。
 */
export async function previewImport(parsed: ParsedBackup): Promise<ImportPreview> {
  const [localRecords, localWatchlist, localPosterKeys] = await Promise.all([
    db.records.toArray(),
    db.watchlist.toArray(),
    db.posters.toCollection().primaryKeys(),
  ])

  const recordMerge = mergeCollections<WatchRecord>(
    localRecords,
    parsed.backup.records,
  )
  const watchlistMerge = mergeCollections<WatchlistItem>(
    localWatchlist,
    parsed.backup.watchlist,
  )

  const localKeys = new Set(localPosterKeys.map(String))
  const referenced = parsed.backup.posters.map((p) => p.key)
  const newPosters = referenced.filter(
    (k) => !localKeys.has(k) && parsed.posterBlobs.has(k),
  ).length
  const missingPosters = referenced.filter(
    (k) => !parsed.posterBlobs.has(k),
  ).length

  const merged = applyMerge(localRecords, recordMerge.toPut)
  const duplicates = findPotentialDuplicates(
    merged,
    (r) => r.tmdbId,
    (r) => r.watchedOn,
  )

  return {
    parsed,
    recordStats: recordMerge.stats,
    watchlistStats: watchlistMerge.stats,
    newPosters,
    missingPosters,
    duplicates,
  }
}

/**
 * 真正落库。整个写入放在一个事务里，任何一步失败就整体回滚，
 * 不会留下「记录写了一半、海报没写」的半成品状态。
 */
export async function applyImport(preview: ImportPreview): Promise<void> {
  const { backup, posterBlobs } = preview.parsed

  const localRecords = await db.records.toArray()
  const localWatchlist = await db.watchlist.toArray()

  const recordMerge = mergeCollections<WatchRecord>(localRecords, backup.records)
  const watchlistMerge = mergeCollections<WatchlistItem>(
    localWatchlist,
    backup.watchlist,
  )

  const localPosterKeys = new Set(
    (await db.posters.toCollection().primaryKeys()).map(String),
  )
  const postersToPut: Poster[] = []
  const now = Date.now()
  for (const entry of backup.posters) {
    if (localPosterKeys.has(entry.key)) continue
    const blob = posterBlobs.get(entry.key)
    if (!blob) continue
    postersToPut.push({
      key: entry.key,
      blob,
      mimeType: entry.mimeType,
      width: entry.width,
      height: entry.height,
      createdAt: now,
    })
  }

  await db.transaction(
    'rw',
    db.records,
    db.watchlist,
    db.posters,
    async () => {
      if (recordMerge.toPut.length) await db.records.bulkPut(recordMerge.toPut)
      if (watchlistMerge.toPut.length) {
        await db.watchlist.bulkPut(watchlistMerge.toPut)
      }
      if (postersToPut.length) await db.posters.bulkPut(postersToPut)
    },
  )
}
