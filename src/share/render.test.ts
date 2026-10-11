import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import type { WatchRecord } from '../db/types'
import { planShare } from './layout'
import { renderPlan } from './render'

/**
 * render.ts 的冒烟测试。
 *
 * 项目跑在 vitest 的 node 环境里，没有真正的 canvas，所以这里给一个假的
 * 2D 上下文，只记录被调用了什么、传了什么参数。测不了「画得好不好看」，
 * 但能测出真正会致命的东西：
 *
 *   - canvas API 参数用错
 *   - 坐标算成了 NaN / Infinity——画出来是一片空白，而且**不报错**
 *   - save / restore 不配对导致 clip 泄漏，整张图会被裁进一个小方框
 *
 * 最后一条是真出过的 bug：drawPoster 里 clip 之后若 drawImage 抛异常，
 * 原来的写法会跳过 restore，把裁剪区一直留着。
 */

function makeCtx() {
  const calls: string[] = []
  const numbers: number[] = []

  const record = (name: string) => (...args: unknown[]) => {
    calls.push(name)
    for (const a of args) {
      if (typeof a === 'number') numbers.push(a)
    }
  }

  return {
    calls,
    numbers,
    ctx: {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 1,
      fillRect: record('fillRect'),
      fillText: record('fillText'),
      beginPath: record('beginPath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      closePath: record('closePath'),
      arcTo: record('arcTo'),
      rect: record('rect'),
      fill: record('fill'),
      save: record('save'),
      restore: record('restore'),
      clip: record('clip'),
      drawImage: record('drawImage'),
      // 粗略估算宽度就够了：只用来判断有没有 NaN
      measureText: (text: string) => ({ width: text.length * 12 }),
    },
  }
}

function rec(
  id: string,
  watchedOn: string,
  extra: Partial<WatchRecord> = {},
): WatchRecord {
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
    rewatchCount: 0,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...extra,
  }
}

/** 第一条挂了海报，用来覆盖「解码成功 → drawImage」这条路径 */
const defaultRecords = [
  rec('a', '2026-03-01', { rating: 4.5, posterKey: 'poster-a' }),
  rec('b', '2026-01-05', { rating: null, cinema: '' }),
  rec('c', '2025-12-20', { versionType: '国语配音', rewatchCount: 2 }),
]

async function render(
  view: 'timeline' | 'grid',
  rows: WatchRecord[] = defaultRecords,
  maxHeight = 4096,
) {
  const { ctx, calls, numbers } = makeCtx()
  const plan = planShare(rows, view, maxHeight)
  const canvas = {
    width: plan.width,
    height: plan.height,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement

  await renderPlan(canvas, plan)
  return { plan, calls, numbers }
}

/** 让 readPalette 走那几个兜底颜色 */
function stubDom() {
  vi.stubGlobal('document', { documentElement: {} })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }))
}

beforeEach(async () => {
  stubDom()

  // 真往库里放一张海报——不然 drawPoster 直接走占位分支，
  // 解码和 drawImage 那段代码一行都跑不到，测了等于没测。
  await db.posters.clear()
  await db.posters.put({
    key: 'poster-a',
    blob: new Blob([new Uint8Array([1, 2, 3])]),
    mimeType: 'image/jpeg',
    width: 342,
    height: 513,
    createdAt: 0,
  })

  vi.stubGlobal('createImageBitmap', async () => ({
    width: 342,
    height: 513,
    close: () => {},
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
  db.close()
})

describe('renderPlan', () => {
  it('列表视图能画完，并真的把海报画了上去', async () => {
    const { calls } = await render('timeline')
    expect(calls).toContain('fillText')
    expect(calls).toContain('drawImage')
  })

  it('网格视图能画完', async () => {
    const { calls } = await render('grid')
    expect(calls).toContain('fillText')
    expect(calls).toContain('drawImage')
  })

  it('空库也能画（只剩页头），不会崩', async () => {
    const { calls } = await render('timeline', [])
    expect(calls).toContain('fillText')
  })

  it('所有坐标都是有限数', async () => {
    for (const view of ['timeline', 'grid'] as const) {
      const { numbers, plan } = await render(view)
      expect(plan.height).toBeGreaterThan(0)
      expect(numbers.filter((n) => !Number.isFinite(n))).toEqual([])
    }
  })

  it('save / restore 配平', async () => {
    for (const view of ['timeline', 'grid'] as const) {
      const { calls } = await render(view)
      expect(calls.filter((c) => c === 'restore').length).toBe(
        calls.filter((c) => c === 'save').length,
      )
    }
  })

  it('海报解码失败时落到占位块，且裁剪区没泄漏', async () => {
    vi.stubGlobal('createImageBitmap', () => {
      throw new Error('模拟解码失败')
    })

    const { calls } = await render('timeline')

    // 解码失败就不该有 drawImage
    expect(calls).not.toContain('drawImage')
    // 而且 save / restore 仍然配平——这正是原来那个 bug 会破坏的性质
    expect(calls.filter((c) => c === 'restore').length).toBe(
      calls.filter((c) => c === 'save').length,
    )
  })
})
