import { describe, expect, it } from 'vitest'
import type { WatchRecord } from '../db/types'
import { IMAGE_WIDTH, planShare, type Block, type ShareView } from './layout'

function rec(id: string, watchedOn: string, rewatchCount = 0): WatchRecord {
  return {
    id,
    tmdbId: null,
    title: `片名 ${id}`,
    year: 2024,
    watchedOn,
    cinema: '某影院',
    hallFormat: '普通',
    versionType: '原版字幕',
    rating: 4,
    review: '',
    rewatchCount,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  }
}

/** 造 n 条，全部落在同一年 */
function many(n: number, year = '2026'): WatchRecord[] {
  return Array.from({ length: n }, (_, i) =>
    rec(`r${i}`, `${year}-03-01`),
  )
}

const of = <K extends Block['kind']>(blocks: Block[], kind: K) =>
  blocks.filter((b): b is Extract<Block, { kind: K }> => b.kind === kind)

/** iOS 17 的实际上限 */
const IOS17 = 4096

describe('planShare', () => {
  it('空库只排页头，并且不留空白高度', () => {
    const plan = planShare([], 'timeline', IOS17)
    expect(plan.blocks.map((b) => b.kind)).toEqual(['header'])
    expect(plan.height).toBeLessThan(600)
    expect(plan.truncated).toBe(false)
    expect(plan.included).toBe(0)
  })

  it('宽度恒定为 IMAGE_WIDTH，两种视图都一样', () => {
    for (const view of ['timeline', 'grid'] as ShareView[]) {
      expect(planShare(many(5), view, IOS17).width).toBe(IMAGE_WIDTH)
    }
  })

  it('按年份分组，顺序跟随传入顺序（listRecords 已按日期倒序）', () => {
    const records = [
      rec('a', '2026-03-01'),
      rec('b', '2026-01-05'),
      rec('c', '2025-12-20'),
      rec('d', '2025-06-01'),
    ]
    const years = of(planShare(records, 'timeline', IOS17).blocks, 'year')
    expect(years.map((b) => b.year)).toEqual(['2026', '2025'])
    expect(years.map((b) => b.count)).toEqual([2, 2])
  })

  it('每条记录都有自己的一块（未截断时）', () => {
    const plan = planShare(many(8), 'timeline', IOS17)
    expect(of(plan.blocks, 'row')).toHaveLength(8)
    expect(plan.included).toBe(8)
    expect(plan.truncated).toBe(false)
  })

  it('网格未截断时，格子数等于记录数', () => {
    const plan = planShare(many(10), 'grid', IOS17)
    expect(of(plan.blocks, 'cell')).toHaveLength(10)
  })

  it('任何情况下高度都不超过给定的上限', () => {
    const max = 3000
    for (const view of ['timeline', 'grid'] as ShareView[]) {
      for (const n of [0, 1, 7, 40, 200, 1000]) {
        expect(planShare(many(n), view, max).height).toBeLessThanOrEqual(max)
      }
    }
  })

  it('记录变多时自动切到更紧的档位', () => {
    const few = planShare(many(3), 'timeline', IOS17)
    const lots = planShare(many(30), 'timeline', IOS17)
    // 海报变小，或者单位行高变小——两者都会让 tier.posterH 下降
    expect(lots.tier.posterH).toBeLessThan(few.tier.posterH)
  })

  it('网格靠加列数来压缩', () => {
    const few = planShare(many(6), 'grid', IOS17)
    const lots = planShare(many(60), 'grid', IOS17)
    expect(lots.tier.cols).toBeGreaterThan(few.tier.cols)
  })

  it('压到最紧仍装不下时截断，并且如实报告', () => {
    const plan = planShare(many(1000), 'timeline', 3000)
    expect(plan.truncated).toBe(true)
    expect(plan.total).toBe(1000)
    expect(plan.included).toBeLessThan(1000)
    expect(plan.included).toBeGreaterThan(0)
    // 画出来的条数要和报告的一致，不能谎报
    expect(of(plan.blocks, 'row')).toHaveLength(plan.included)
  })

  it('页头里的场次统计把重看次数算进去', () => {
    const records = [rec('a', '2026-01-01', 2), rec('b', '2026-02-01', 0)]
    const header = of(planShare(records, 'timeline', IOS17).blocks, 'header')[0]
    expect(header.total).toBe(2)
    // 1 + 2 次重看 + 1 = 4 场
    expect(header.screenings).toBe(4)
  })

  it('上限越紧，能放下的条数越少（单调）', () => {
    const loose = planShare(many(200), 'grid', 16000)
    const tight = planShare(many(200), 'grid', 4000)
    expect(tight.included).toBeLessThanOrEqual(loose.included)
    expect(tight.tier.cols).toBeGreaterThanOrEqual(loose.tier.cols)
  })
})
