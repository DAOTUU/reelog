import type { WatchRecord, WatchlistItem } from '../db/types'

/** 导出包的标识与版本。version 是将来模型升级时的迁移锚点。 */
export const BACKUP_FORMAT = 'reelog'
export const BACKUP_VERSION = 1

export type PosterEntry = {
  key: string
  mimeType: string
  width: number
  height: number
  /** zip 内的路径，如 posters/<key>.jpg。扩展名由 mimeType 推导，不硬编码。 */
  file: string
}

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: number
  records: WatchRecord[]
  watchlist: WatchlistItem[]
  posters: PosterEntry[]
}

export function isBackupFile(v: unknown): v is BackupFile {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    o.format === BACKUP_FORMAT &&
    typeof o.version === 'number' &&
    Array.isArray(o.records) &&
    Array.isArray(o.watchlist) &&
    Array.isArray(o.posters)
  )
}

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

/**
 * 由 mimeType 推导扩展名。
 *
 * 不能硬编码 .webp —— iOS Safari 的 canvas 没有 WebP 编码器，
 * 会静默返回 PNG。硬编码扩展名会让导出包里出现「名为 .webp 实为 PNG」
 * 的文件，别的软件打不开。
 */
export function extFromMime(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? 'bin'
}

export function mimeFromExt(ext: string): string {
  const hit = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)
  return hit?.[0] ?? 'application/octet-stream'
}
