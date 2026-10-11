import { describe, expect, it } from 'vitest'
import { findPotentialDuplicates, mergeCollections } from './merge'

type R = {
  id: string
  updatedAt: number
  deletedAt: number | null
  title: string
  tmdbId?: number | null
  watchedOn?: string
}

const rec = (
  id: string,
  updatedAt: number,
  title: string,
  extra: Partial<R> = {},
): R => ({ id, updatedAt, deletedAt: null, title, ...extra })

describe('mergeCollections', () => {
  it('本地没有的记录会被新增', () => {
    const { toPut, stats } = mergeCollections<R>([], [rec('a', 100, 'A')])
    expect(toPut).toHaveLength(1)
    expect(stats).toMatchObject({ added: 1, updated: 0, unchanged: 0 })
  })

  it('导入方 updatedAt 更新时覆盖本地', () => {
    const { toPut, stats } = mergeCollections<R>(
      [rec('a', 100, '旧')],
      [rec('a', 200, '新')],
    )
    expect(toPut[0].title).toBe('新')
    expect(stats).toMatchObject({ updated: 1, overwritten: 1, added: 0 })
  })

  it('本地 updatedAt 更新时保留本地，不被旧数据覆盖', () => {
    const { toPut, stats } = mergeCollections<R>(
      [rec('a', 300, '本地新')],
      [rec('a', 200, '导入旧')],
    )
    expect(toPut).toHaveLength(0)
    expect(stats).toMatchObject({ unchanged: 1, updated: 0 })
  })

  it('updatedAt 相等时保留本地，不产生无意义写入', () => {
    const { toPut, stats } = mergeCollections<R>(
      [rec('a', 100, '本地')],
      [rec('a', 100, '导入')],
    )
    expect(toPut).toHaveLength(0)
    expect(stats.unchanged).toBe(1)
  })

  // ⚠️ 这条是整个函数最重要的安全保证
  it('本地独有、导入包里没有的记录一律保留（并集，绝不删除）', () => {
    const { toPut } = mergeCollections<R>(
      [rec('a', 100, '本地独有')],
      [rec('b', 100, '导入新增')],
    )
    // toPut 只含新增/覆盖的；关键是本地那条不能被「抹掉」——
    // 函数不返回任何删除指令，本地数据在调用方手里原封不动
    expect(toPut.map((r) => r.id)).toEqual(['b'])
    expect(toPut.some((r) => r.id === 'a')).toBe(false)
  })

  it('空导入包不产生任何变更', () => {
    const { toPut, stats } = mergeCollections<R>([rec('a', 100, 'A')], [])
    expect(toPut).toHaveLength(0)
    expect(stats).toEqual({
      added: 0,
      updated: 0,
      unchanged: 0,
      overwritten: 0,
    })
  })

  it('导入方带更新的软删除时，照删', () => {
    const { toPut } = mergeCollections<R>(
      [rec('a', 100, '还在', { deletedAt: null })],
      [rec('a', 200, '已删', { deletedAt: 200 })],
    )
    expect(toPut[0].deletedAt).toBe(200)
  })

  // ⚠️ 这条是「软删除」机制存在的理由
  it('本地的软删除不会被导入包里的旧副本复活', () => {
    const { toPut, stats } = mergeCollections<R>(
      [rec('a', 300, '已删', { deletedAt: 300 })],
      [rec('a', 100, '旧副本', { deletedAt: null })],
    )
    expect(toPut).toHaveLength(0)
    expect(stats.unchanged).toBe(1)
  })

  it('内容相同的覆盖不计入 overwritten', () => {
    const { stats } = mergeCollections<R>(
      [rec('a', 100, '一样')],
      [rec('a', 200, '一样')],
    )
    expect(stats).toMatchObject({ updated: 1, overwritten: 0 })
  })
})

describe('findPotentialDuplicates', () => {
  const getId = (r: R) => r.tmdbId ?? null
  const getDate = (r: R) => r.watchedOn ?? ''

  it('同 tmdbId 同日期但 id 不同时标记为疑似重复', () => {
    const dupes = findPotentialDuplicates(
      [
        rec('a', 1, '沙丘 2', { tmdbId: 693134, watchedOn: '2026-09-27' }),
        rec('b', 2, '沙丘 2', { tmdbId: 693134, watchedOn: '2026-09-27' }),
      ],
      getId,
      getDate,
    )
    expect(dupes).toHaveLength(1)
    expect(dupes[0]).toHaveLength(2)
  })

  it('同 tmdbId 但日期不同不算重复（可以看两遍）', () => {
    const dupes = findPotentialDuplicates(
      [
        rec('a', 1, '沙丘 2', { tmdbId: 693134, watchedOn: '2026-09-27' }),
        rec('b', 2, '沙丘 2', { tmdbId: 693134, watchedOn: '2026-10-01' }),
      ],
      getId,
      getDate,
    )
    expect(dupes).toHaveLength(0)
  })

  it('已软删除的记录不参与重复判定', () => {
    const dupes = findPotentialDuplicates(
      [
        rec('a', 1, '沙丘 2', { tmdbId: 693134, watchedOn: '2026-09-27' }),
        rec('b', 2, '沙丘 2', {
          tmdbId: 693134,
          watchedOn: '2026-09-27',
          deletedAt: 5,
        }),
      ],
      getId,
      getDate,
    )
    expect(dupes).toHaveLength(0)
  })

  it('没有 tmdbId 的手动记录不参与判定', () => {
    const dupes = findPotentialDuplicates(
      [
        rec('a', 1, '手记', { tmdbId: null, watchedOn: '2026-09-27' }),
        rec('b', 2, '手记', { tmdbId: null, watchedOn: '2026-09-27' }),
      ],
      getId,
      getDate,
    )
    expect(dupes).toHaveLength(0)
  })
})
