import { zip, type ZipOptions } from 'fflate'
import { db } from '../db/db'
import { META_KEYS, setMeta } from '../db/meta'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  extFromMime,
  type BackupFile,
  type PosterEntry,
} from './schema'

export type BuiltBackup = {
  blob: Blob
  file: BackupFile
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export const backupFilename = (d?: Date) => `reelog-${stamp(d)}.zip`

/**
 * 把整库打成一个 zip。
 *
 * 注意导出的是**全表**，包含软删除的记录——这样导入方的合并逻辑
 * 才能看到「这条被删过」，否则删除会被旧副本复活。
 */
export async function buildBackup(): Promise<BuiltBackup> {
  const [records, watchlist, posters] = await Promise.all([
    db.records.toArray(),
    db.watchlist.toArray(),
    db.posters.toArray(),
  ])

  const entries: Record<string, Uint8Array | [Uint8Array, ZipOptions]> = {}
  const posterEntries: PosterEntry[] = []

  for (const p of posters) {
    // 扩展名由实际 mimeType 推导。iOS 上 canvas 没有 WebP 编码器，
    // 存进来的可能是 JPEG——硬编码 .webp 会产出名实不符的文件。
    const ext = extFromMime(p.mimeType)
    const path = `posters/${p.key}.${ext}`

    posterEntries.push({
      key: p.key,
      mimeType: p.mimeType,
      width: p.width,
      height: p.height,
      file: path,
    })

    // 图片本身已是压缩格式，再压一遍纯属浪费 CPU 和时间
    entries[path] = [new Uint8Array(await p.blob.arrayBuffer()), { level: 0 }]
  }

  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    records,
    watchlist,
    posters: posterEntries,
  }

  entries['data.json'] = new TextEncoder().encode(JSON.stringify(file))

  const blob = await new Promise<Blob>((resolve, reject) => {
    // 用异步版 fflate.zip：同步版在大包上会把主线程卡死
    zip(entries, (err, data) => {
      if (err) reject(err)
      else resolve(new Blob([data as BlobPart], { type: 'application/zip' }))
    })
  })

  return { blob, file }
}

/** 导出并记录时间，供备份提醒使用 */
export async function exportBackup(): Promise<BuiltBackup> {
  const built = await buildBackup()
  await setMeta(META_KEYS.lastExportAt, Date.now())
  return built
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 不能立刻 revoke——某些浏览器还没开始读这个 URL 就被撤销，下载会静默失败
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
