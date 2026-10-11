import type { HallFormat, VersionType } from '../lib/constants'

export interface WatchRecord {
  id: string
  tmdbId: number | null
  title: string
  originalTitle?: string
  year: number | null
  /** 指向 posters 表的主键。没有海报时为 undefined。 */
  posterKey?: string

  /** 'YYYY-MM-DD' 纯日期字符串。绝不要用 new Date(str) 再按本地时区回写。 */
  watchedOn: string
  cinema: string
  hallFormat: HallFormat
  versionType: VersionType

  rating: number | null
  review: string
  rewatchCount: number

  createdAt: number
  /** 合并两份数据时的判定依据：同 id 取 updatedAt 较新的一方。 */
  updatedAt: number
  /** 软删除标记。硬删除会让导入时被别的设备的旧副本「复活」。 */
  deletedAt: number | null
}

export interface WatchlistItem {
  id: string
  tmdbId: number | null
  title: string
  year: number | null
  posterKey?: string
  note?: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface Poster {
  key: string
  blob: Blob
  /** 实际编码格式。Chrome 上可能是 image/webp，iOS Safari 上会是 image/jpeg。 */
  mimeType: string
  width: number
  height: number
  createdAt: number
}

export interface MetaRow {
  key: string
  value: unknown
}

/** 新建记录时由表单提供的字段（id 与三个时间戳由数据层补） */
export type NewRecord = Omit<
  WatchRecord,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>

export type NewWatchlistItem = Omit<
  WatchlistItem,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>

/**
 * 库内的备份快照。
 *
 * 导入前必须自动存一份当前数据进去——用户点错文件、或者导入包本身有问题时，
 * 这是唯一的退路。浏览器里的「下载」很容易被忽略，存在库里才真的救得回来。
 */
export interface Backup {
  id: string
  kind: 'pre-import' | 'manual'
  createdAt: number
  label: string
  blob: Blob
  recordCount: number
  posterCount: number
}
