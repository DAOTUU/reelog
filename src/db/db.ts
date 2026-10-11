import Dexie, { type EntityTable } from 'dexie'
import type {
  Backup,
  MetaRow,
  Poster,
  WatchRecord,
  WatchlistItem,
} from './types'

export const db = new Dexie('reelog') as Dexie & {
  records: EntityTable<WatchRecord, 'id'>
  watchlist: EntityTable<WatchlistItem, 'id'>
  posters: EntityTable<Poster, 'key'>
  backups: EntityTable<Backup, 'id'>
  meta: EntityTable<MetaRow, 'key'>
}

/**
 * ⚠️ 不要给 deletedAt 建索引。
 *
 * IndexedDB 不索引 null / undefined。活动记录的 deletedAt 是 null，
 * 它们压根不会进入该索引，于是 where('deletedAt').equals(null) 一条都查不到，
 * 而 where('deletedAt').equals(0) 之类的写法又查不出「未删除」的。
 *
 * 软删过滤一律在 JS 里做：rows.filter(r => !r.deletedAt)。
 * 个人量级（万条以内）这个开销可以忽略。
 *
 * 将来若真的需要按删除状态索引，改用 `deleted: 0 | 1` 整数标志位。
 */
db.version(1).stores({
  records: 'id, watchedOn, tmdbId, updatedAt',
  watchlist: 'id, tmdbId, createdAt',
  posters: 'key, createdAt',
  backups: 'id, createdAt',
  meta: 'key',
})

/** 以后加字段用 db.version(2).stores({...}).upgrade(tx => ...)，Dexie 会按序执行 */
