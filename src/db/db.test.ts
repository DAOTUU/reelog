import 'fake-indexeddb/auto'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from './db'

/**
 * 这份清单必须与 db.ts 里 `db.version(1).stores({...})` 保持一致。
 *
 * 为什么不靠类型检查：`stores()` 接收的是一个宽松的键值对象，TypeScript
 * **无法校验「类型里声明的表是否都列进了 schema」**。漏写一张表的后果是
 * 这张表在运行时是 undefined，而报错出现在毫不相干的调用点——
 * 比如点「导出」时报 `db.backups.toArray` 不存在，排查方向完全被带偏。
 *
 * 这个 bug 真实发生过一次（backups 只加进了类型声明，忘了加进 schema）。
 * 所以这里用运行时事实去校验，而不是再写一份类型。
 */
const EXPECTED_TABLES = ['records', 'watchlist', 'posters', 'backups', 'meta']

describe('数据库 schema', () => {
  afterAll(() => {
    db.close()
  })

  it('能正常打开，没有版本冲突', async () => {
    await db.open()
    expect(db.isOpen()).toBe(true)
  })

  it('stores() 声明的表与预期一致', () => {
    const actual = db.tables.map((t) => t.name).sort()
    expect(actual).toEqual([...EXPECTED_TABLES].sort())
  })

  it('每张表都真的挂在 db 实例上，而不是只有类型声明', () => {
    for (const name of EXPECTED_TABLES) {
      const table = (db as unknown as Record<string, unknown>)[name]
      expect(
        table,
        `表 ${name} 没挂到 db 上——检查 db.ts 的 stores() 里是不是漏写了`,
      ).toBeDefined()
    }
  })

  it('records 的索引齐全，且刻意不索引 deletedAt', () => {
    const names = db
      .table('records')
      .schema.indexes.map((i) => i.name)
      .sort()

    expect(names).toEqual(['tmdbId', 'updatedAt', 'watchedOn'])

    // IndexedDB 不索引 null，活动记录的 deletedAt 是 null，
    // 建了索引也查不出「未删除」的记录。详见 db.ts 的注释。
    expect(names).not.toContain('deletedAt')
  })

  it('backups 表可读写（曾因漏写 schema 而整表缺失）', async () => {
    await db.backups.put({
      id: 'test-backup',
      kind: 'manual',
      label: 'test',
      blob: new Blob([new Uint8Array([1, 2, 3])]),
      recordCount: 0,
      posterCount: 0,
      createdAt: Date.now(),
    })
    const rows = await db.backups.toArray()
    expect(rows).toHaveLength(1)
    await db.backups.clear()
  })
})
