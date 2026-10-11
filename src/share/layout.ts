import type { WatchRecord } from '../db/types'

/**
 * 分享长图的排版计算。
 *
 * ⚠️ 这个文件是**纯函数**，不许碰 DOM、不许碰 canvas。
 * 原因很实际：项目的测试环境是 vitest + environment: 'node'，根本没有
 * document。只要沾一点 DOM，整个排版逻辑就一行都测不了。所以这里只算
 * 「每块画在哪、多高」，具体怎么画交给 render.ts。
 */

export type ShareView = 'timeline' | 'grid'

/** 目标图宽（图像像素）。1080 ≈ 3 倍于 360pt 的手机逻辑宽度。 */
export const IMAGE_WIDTH = 1080

/**
 * 设计基准宽度。
 *
 * 界面里那些尺寸（海报 56×84、字号 16/14/12）都是按手机逻辑宽度写的，
 * 乘这个系数就换算到图像像素。这样图上的比例和 App 里看到的一致。
 */
const DESIGN_WIDTH = 390
const K = IMAGE_WIDTH / DESIGN_WIDTH

/**
 * 设计单位（手机逻辑 px）→ 图像像素。
 * 导出给 render.ts 用——换算系数只能有一个来源，两边各写一份迟早算岔。
 */
export const toImagePx = (v: number) => Math.round(v * K)
const px = toImagePx

export type Block =
  | { kind: 'header'; y: number; h: number; total: number; screenings: number }
  | { kind: 'year'; y: number; h: number; year: string; count: number }
  | { kind: 'row'; y: number; h: number; record: WatchRecord }
  | {
      kind: 'cell'
      x: number
      y: number
      w: number
      h: number
      record: WatchRecord
    }

/** 某一密度档位下的具体尺寸，全部是图像像素 */
export type ShareTier = {
  posterW: number
  posterH: number
  /** 列表行内上下内边距 */
  padY: number
  /** 字号 */
  title: number
  meta: number
  /** 年份分组之间的额外间距 */
  gapY: number
  /** 网格列数。列表恒为 1。 */
  cols: number
}

export type SharePlan = {
  width: number
  height: number
  view: ShareView
  tier: ShareTier
  /** 压到最紧仍装不下，只画了最近的一批 */
  truncated: boolean
  /** 实际画进去几条 */
  included: number
  /** 库里一共几条 */
  total: number
  blocks: Block[]
}

/* ---------------------------------------------------------------------------
   密度阶梯

   为什么是离散档位而不是一个连续的缩放系数：列表行的高度主要由海报撑起来，
   而文字和海报的「可读下限」差得很远——海报缩到一半还能看出是哪部片，
   字缩到一半就没人看得清了。所以海报要比文字缩得快。用连续的 scale 会把
   两者绑在一起，要么放不下、要么字没法看。

   档位从宽松排到极紧，planShare 从上往下取第一个装得下的。
   --------------------------------------------------------------------------- */

type TierSpec = {
  posterW: number
  posterH: number
  padY: number
  title: number
  meta: number
  gapY: number
}

/** 单位是设计 px，与界面里 Tailwind 的写法一一对应 */
const TIMELINE_SPECS: TierSpec[] = [
  { posterW: 56, posterH: 84, padY: 14, title: 16, meta: 12, gapY: 20 },
  { posterW: 48, posterH: 72, padY: 12, title: 15, meta: 11, gapY: 18 },
  { posterW: 40, posterH: 60, padY: 10, title: 14, meta: 10.5, gapY: 16 },
  { posterW: 32, posterH: 48, padY: 9, title: 13, meta: 10, gapY: 14 },
  { posterW: 24, posterH: 36, padY: 8, title: 12, meta: 9.5, gapY: 12 },
  { posterW: 18, posterH: 27, padY: 7, title: 11, meta: 9, gapY: 10 },
]

/** 网格的密度靠加列数。列越多，海报越小、一行能塞越多。 */
const GRID_COLS = [3, 4, 5, 6, 8]
const GRID_PAD_X = 20
const GRID_GAP_X = 12
/** 列数越多，片名就得越小，否则会被截成一堆省略号 */
const GRID_TITLE_SIZE = [12, 11.5, 11, 10.5, 10]

const PAD_X = 20
const TOP_PAD = 24
const HEADER_H = 92
const YEAR_H = 30
const BOTTOM_PAD = 24
/** 网格里海报与片名之间的间距 */
const GRID_TITLE_GAP = 8
/** 网格行与行之间的间距 */
const GRID_ROW_GAP = 20

function timelineTier(spec: TierSpec): ShareTier {
  return {
    posterW: px(spec.posterW),
    posterH: px(spec.posterH),
    padY: px(spec.padY),
    title: px(spec.title),
    meta: px(spec.meta),
    gapY: px(spec.gapY),
    cols: 1,
  }
}

function gridTier(cols: number, titleSize: number): ShareTier {
  const padX = px(GRID_PAD_X)
  const gapX = px(GRID_GAP_X)
  const cellW = Math.floor(
    (IMAGE_WIDTH - padX * 2 - gapX * (cols - 1)) / cols,
  )
  return {
    posterW: cellW,
    // 海报固定 2:3，与界面里的 aspect-[2/3] 一致
    posterH: Math.round(cellW * 1.5),
    // 网格不分组，padY 借来表示「海报与片名之间的间距」
    padY: px(GRID_TITLE_GAP),
    title: px(titleSize),
    meta: px(titleSize),
    gapY: 0,
    cols,
  }
}

/**
 * 网格单元的行内尺寸。
 *
 * 导出给 render.ts 共用：排版算高度、绘制算基线，必须用同一套公式，
 * 否则图上的片名会和下一行叠在一起。
 */
export function gridCellMetrics(tier: ShareTier) {
  const titleLine = Math.round(tier.title * 1.35)
  const starsLine = Math.round(tier.meta * 1.8)
  return {
    padY: tier.padY,
    titleLine,
    starsLine,
    cellH: tier.posterH + tier.padY + titleLine + starsLine,
  }
}

/** 从宽松到紧凑 */
function tiersFor(view: ShareView): ShareTier[] {
  if (view === 'timeline') return TIMELINE_SPECS.map(timelineTier)
  return GRID_COLS.map((cols, i) => gridTier(cols, GRID_TITLE_SIZE[i]))
}

/* ---------------------------------------------------------------------------
   排版
   --------------------------------------------------------------------------- */

/** 年份分组。顺序沿用传进来的顺序（listRecords 已按 watchedOn 倒序）。 */
function groupByYear(records: WatchRecord[]): [string, WatchRecord[]][] {
  const m = new Map<string, WatchRecord[]>()
  for (const r of records) {
    const y = r.watchedOn.slice(0, 4)
    const list = m.get(y)
    if (list) list.push(r)
    else m.set(y, [r])
  }
  return [...m.entries()]
}

function screeningsOf(records: WatchRecord[]): number {
  return records.reduce((n, r) => n + 1 + r.rewatchCount, 0)
}

function layoutTimeline(records: WatchRecord[], tier: ShareTier): Block[] {
  const blocks: Block[] = []
  const rowH = tier.posterH + tier.padY * 2
  let y = px(TOP_PAD)

  blocks.push({
    kind: 'header',
    y,
    h: px(HEADER_H),
    total: records.length,
    screenings: screeningsOf(records),
  })
  y += px(HEADER_H)

  for (const [year, list] of groupByYear(records)) {
    y += tier.gapY
    blocks.push({ kind: 'year', y, h: px(YEAR_H), year, count: list.length })
    y += px(YEAR_H)

    for (const r of list) {
      blocks.push({ kind: 'row', y, h: rowH, record: r })
      y += rowH
    }
  }

  return blocks
}

function layoutGrid(records: WatchRecord[], tier: ShareTier): Block[] {
  const blocks: Block[] = []
  const padX = px(PAD_X)
  const gapX = px(GRID_GAP_X)
  const { cellH } = gridCellMetrics(tier)
  const stride = cellH + px(GRID_ROW_GAP)

  let y = px(TOP_PAD)
  blocks.push({
    kind: 'header',
    y,
    h: px(HEADER_H),
    total: records.length,
    screenings: screeningsOf(records),
  })
  y += px(HEADER_H) + px(16)

  records.forEach((r, i) => {
    const col = i % tier.cols
    blocks.push({
      kind: 'cell',
      x: padX + col * (tier.posterW + gapX),
      y,
      w: tier.posterW,
      h: cellH,
      record: r,
    })
    // 一行画满才换行
    if (col === tier.cols - 1) y += stride
  })

  // 最后一行没画满也要占位，否则底部会贴到画布边缘
  if (records.length % tier.cols !== 0) y += stride

  return blocks
}

function layout(
  records: WatchRecord[],
  view: ShareView,
  tier: ShareTier,
): { blocks: Block[]; height: number } {
  const blocks =
    view === 'timeline'
      ? layoutTimeline(records, tier)
      : layoutGrid(records, tier)

  // 所有块都有 y 和 h，最后一块的底边就是内容底边。
  // 空库时 blocks 里只有页头，同样成立。
  const last = blocks[blocks.length - 1]
  return { blocks, height: last.y + last.h + px(BOTTOM_PAD) }
}

/* ---------------------------------------------------------------------------
   对外入口
   --------------------------------------------------------------------------- */

/**
 * 把记录排进一张不超过 maxHeight 的图。
 *
 * 策略：从最宽松的档位往下试，第一个装得下的就返回。全部装不下时，
 * 退到最紧的档位并**二分出能放下多少条**——这是物理上唯一的出路，
 * 因为 canvas 画不下就是画不下，没有别的办法。
 *
 * 截断时 truncated 置位，界面必须把这件事明说给用户，不能悄悄少画。
 */
export function planShare(
  records: WatchRecord[],
  view: ShareView,
  maxHeight: number,
): SharePlan {
  const tiers = tiersFor(view)

  for (const tier of tiers) {
    const { blocks, height } = layout(records, view, tier)
    if (height <= maxHeight) {
      return {
        width: IMAGE_WIDTH,
        height,
        view,
        tier,
        truncated: false,
        included: records.length,
        total: records.length,
        blocks,
      }
    }
  }

  // 最紧的档位仍装不下：二分出最多能放几条
  const tight = tiers[tiers.length - 1]
  let lo = 0
  let hi = records.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (layout(records.slice(0, mid), view, tight).height <= maxHeight) lo = mid
    else hi = mid - 1
  }

  const kept = records.slice(0, lo)
  const { blocks, height } = layout(kept, view, tight)

  return {
    width: IMAGE_WIDTH,
    height,
    view,
    tier: tight,
    truncated: true,
    included: kept.length,
    total: records.length,
    blocks,
  }
}
