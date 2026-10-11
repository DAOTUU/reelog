import { db } from '../db/db'
import type { WatchRecord } from '../db/types'
import {
  IMAGE_WIDTH,
  gridCellMetrics,
  toImagePx,
  type Block,
  type SharePlan,
  type ShareTier,
} from './layout'

/**
 * 把 SharePlan 画到 canvas 上。
 *
 * 这里只管「怎么画」——「画在哪、画多大」全在 layout.ts 算好了。两边的尺寸
 * 公式必须共用（`toImagePx` / `gridCellMetrics`），各写一份迟早算岔，
 * 然后图上就会出现片名和下一行叠在一起。
 *
 * 配色从 CSS 变量读、不硬编码。canvas 用不了 Tailwind 类，读变量是唯一的桥；
 * 顺带的好处是**图上的配色自动跟着系统深浅色走**，和用户当下看到的界面一致。
 */

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif'

const font = (weight: number | string, size: number) =>
  `${weight} ${size}px ${FONT_STACK}`

type Palette = {
  bg: string
  ink: string
  ink2: string
  muted: string
  line: string
  surface2: string
  accent: string
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--canvas', '#ffffff'),
    ink: v('--ink', '#18181b'),
    ink2: v('--ink-2', '#52525b'),
    muted: v('--muted', '#8e8e96'),
    line: v('--line', '#e4e4e7'),
    surface2: v('--surface-2', '#ececee'),
    accent: v('--accent', '#b45309'),
  }
}

/* ---------------------------------------------------------------------------
   基础绘制件
   --------------------------------------------------------------------------- */

/** 手写圆角矩形。不用 ctx.roundRect——那个 Safari 16 才有，没必要为了省几行去赌。 */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * 超宽就截断加省略号。canvas 没有 CSS 的 truncate，只能自己量。
 *
 * 二分而不是逐字加：中文没有词边界，逐字断行本来就是对的做法，
 * 但一个字一个 measureText 在几百行的图上会明显变卡。
 */
function ellipsis(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return ''
  if (ctx.measureText(text).width <= maxWidth) return text

  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo <= 0 ? '' : `${text.slice(0, lo)}…`
}

function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/**
 * 画 5 颗星，返回占用宽度。
 *
 * 界面上的 RatingStars 是 DOM 组件（两层 SVG 靠宽度裁剪出半颗），
 * canvas 里复用不了，只能重画一遍。半颗星用 clip 切。
 */
function drawStars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rating: number,
  palette: Palette,
): number {
  const gap = size * 0.18
  const cy = y + size / 2
  const r = size * 0.46

  for (let i = 0; i < 5; i++) {
    const cx = x + i * (size + gap) + size / 2
    const fill = Math.max(0, Math.min(1, rating - i))

    starPath(ctx, cx, cy, r)
    ctx.fillStyle = palette.line
    ctx.fill()

    if (fill > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(cx - r, cy - r, r * 2 * fill, r * 2)
      ctx.clip()
      starPath(ctx, cx, cy, r)
      ctx.fillStyle = palette.accent
      ctx.fill()
      ctx.restore()
    }
  }

  return 5 * size + 4 * gap
}

/**
 * 画海报。逐张串行、画完立刻 close——几百张 bitmap 同时驻留会把内存撑爆，
 * 手机上是直接崩掉，不是变慢那么简单。
 */
async function drawPoster(
  ctx: CanvasRenderingContext2D,
  posterKey: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  palette: Palette,
): Promise<void> {
  const poster = posterKey ? await db.posters.get(posterKey) : undefined

  if (!poster?.blob) {
    // 占位块。不画任何图标——图上不需要解释「这里本来有张图」。
    ctx.fillStyle = palette.surface2
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.fill()
    return
  }

  let bitmap: ImageBitmap | undefined
  if (poster?.blob) {
    try {
      bitmap = await createImageBitmap(poster.blob)
    } catch {
      // 单张海报解码失败不该毁掉整张图，下面走占位分支即可
      bitmap = undefined
    }
  }

  if (!bitmap) {
    ctx.fillStyle = palette.surface2
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.fill()
    return
  }

  ctx.save()
  try {
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.clip()
    // 等价于 CSS 的 object-cover：源图按较大比例缩放后居中裁切
    const scale = Math.max(w / bitmap.width, h / bitmap.height)
    const sw = w / scale
    const sh = h / scale
    ctx.drawImage(
      bitmap,
      (bitmap.width - sw) / 2,
      (bitmap.height - sh) / 2,
      sw,
      sh,
      x,
      y,
      w,
      h,
    )
  } finally {
    // ⚠️ restore 必须在 finally 里。clip 是画布状态的一部分，
    // 万一 drawImage 抛了而没 restore，裁剪区会一直留着，
    // 后面所有绘制都被裁进这张海报的方框里——整张图就废了。
    ctx.restore()
    bitmap.close?.()
  }
}

/* ---------------------------------------------------------------------------
   各区块
   --------------------------------------------------------------------------- */

function drawHeader(
  ctx: CanvasRenderingContext2D,
  y: number,
  h: number,
  total: number,
  screenings: number,
  palette: Palette,
): void {
  const padX = toImagePx(20)
  const display = toImagePx(27)
  const meta = toImagePx(12)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.fillStyle = palette.ink
  ctx.font = font(700, display)
  ctx.fillText('Reelog', padX, y + toImagePx(4))

  ctx.fillStyle = palette.muted
  ctx.font = font(400, meta)
  ctx.fillText(
    `${total} 部 · ${screenings} 场`,
    padX,
    y + toImagePx(4) + Math.round(display * 1.15),
  )

  // 页头下面一条发丝线，把标题区和内容分开
  ctx.fillStyle = palette.line
  ctx.fillRect(padX, y + h - 2, IMAGE_WIDTH - padX * 2, 2)
}

function drawYear(
  ctx: CanvasRenderingContext2D,
  y: number,
  year: string,
  count: number,
  tier: ShareTier,
  palette: Palette,
): void {
  const padX = toImagePx(20)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.font = font(500, tier.meta)
  ctx.fillStyle = palette.muted
  ctx.fillText(year, padX, y)

  const yearW = ctx.measureText(year).width
  ctx.globalAlpha = 0.6
  ctx.fillText(`${count} 部`, padX + yearW + tier.meta * 0.8, y)
  ctx.globalAlpha = 1
}

function drawTimelineRow(
  ctx: CanvasRenderingContext2D,
  block: Extract<Block, { kind: 'row' }>,
  tier: ShareTier,
  palette: Palette,
): void {
  const r = block.record
  const padX = toImagePx(20)
  const gap = toImagePx(16)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const textX = padX + tier.posterW + gap
  const textW = IMAGE_WIDTH - padX - textX
  const titleY = block.y + tier.padY

  // 片名 + 年份
  ctx.font = font(600, tier.title)
  ctx.fillStyle = palette.ink
  const titleText = ellipsis(ctx, r.title, textW)
  ctx.fillText(titleText, textX, titleY)

  if (r.year !== null) {
    const used = ctx.measureText(titleText).width + tier.title * 0.5
    const yearStr = String(r.year)
    ctx.font = font(400, tier.meta)
    if (used + ctx.measureText(yearStr).width <= textW) {
      ctx.fillStyle = palette.muted
      ctx.fillText(yearStr, textX + used, titleY + (tier.title - tier.meta) * 0.6)
    }
  }

  // 影院
  const titleLine = Math.round(tier.title * 1.35)
  const cinemaSize = Math.round(tier.meta * 1.15)
  ctx.font = font(400, cinemaSize)
  if (r.cinema) {
    ctx.fillStyle = palette.ink2
    ctx.fillText(ellipsis(ctx, r.cinema, textW), textX, titleY + titleLine)
  } else {
    ctx.fillStyle = palette.muted
    ctx.fillText('未填影院', textX, titleY + titleLine)
  }

  // 底部一行：影厅标签 · 日期等 · 星级（右对齐）
  const [, month, day] = r.watchedOn.split('-')
  const extras = [
    `${Number(month)}月${Number(day)}日`,
    r.versionType !== '原版字幕' ? r.versionType : null,
    r.rewatchCount > 0 ? `重看 ${r.rewatchCount}` : null,
  ].filter(Boolean) as string[]

  const chipH = Math.round(tier.meta * 1.7)
  const bottomY = block.y + block.h - tier.padY - chipH

  ctx.font = font(400, tier.meta)
  const chipPadX = tier.meta * 0.5
  const chipW = ctx.measureText(r.hallFormat).width + chipPadX * 2
  ctx.fillStyle = palette.surface2
  roundRectPath(ctx, textX, bottomY, chipW, chipH, tier.meta * 0.4)
  ctx.fill()
  ctx.fillStyle = palette.ink2
  ctx.fillText(
    r.hallFormat,
    textX + chipPadX,
    bottomY + (chipH - tier.meta) / 2,
  )

  let rightEdge = textX + chipW + tier.meta * 0.8
  if (r.rating !== null) {
    const starSize = Math.round(tier.meta * 1.3)
    const starsW = 5 * starSize + 4 * starSize * 0.18
    drawStars(
      ctx,
      IMAGE_WIDTH - padX - starsW,
      bottomY + (chipH - starSize) / 2,
      starSize,
      r.rating,
      palette,
    )
    rightEdge = IMAGE_WIDTH - padX - starsW - tier.meta
  }

  ctx.fillStyle = palette.muted
  ctx.font = font(400, tier.meta)
  const extrasText = extras.join(' · ')
  const extrasW = IMAGE_WIDTH - padX - rightEdge
  if (extrasW > 0) {
    ctx.fillText(
      ellipsis(ctx, extrasText, extrasW),
      rightEdge,
      bottomY + (chipH - tier.meta) / 2,
    )
  }
}

function drawGridCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tier: ShareTier,
  record: WatchRecord,
  palette: Palette,
): void {
  const { padY, titleLine, starsLine } = gridCellMetrics(tier)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const textY = y + tier.posterH + padY

  ctx.font = font(500, tier.title)
  ctx.fillStyle = palette.ink
  ctx.fillText(ellipsis(ctx, record.title, tier.posterW), x, textY)

  if (record.rating !== null) {
    const starSize = Math.round(tier.meta * 1.15)
    drawStars(
      ctx,
      x,
      textY + titleLine + (starsLine - starSize) / 2,
      starSize,
      record.rating,
      palette,
    )
  }
}

function drawEmpty(
  ctx: CanvasRenderingContext2D,
  y: number,
  palette: Palette,
): void {
  const size = toImagePx(14)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = font(400, size)
  ctx.fillStyle = palette.muted
  ctx.fillText('还没有记录', IMAGE_WIDTH / 2, y)
}

/* ---------------------------------------------------------------------------
   入口
   --------------------------------------------------------------------------- */

export type RenderProgress = (done: number, total: number) => void

export async function renderPlan(
  canvas: HTMLCanvasElement,
  plan: SharePlan,
  onProgress?: RenderProgress,
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 canvas 上下文')

  const palette = readPalette()

  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, plan.width, plan.height)

  // 海报要一张张 await，所以先算出一共要处理几张，进度才有意义
  const posterBlocks = plan.blocks.filter(
    (b) => b.kind === 'row' || b.kind === 'cell',
  )
  let done = 0
  onProgress?.(0, posterBlocks.length)

  for (const block of plan.blocks) {
    switch (block.kind) {
      case 'header':
        drawHeader(
          ctx,
          block.y,
          block.h,
          block.total,
          block.screenings,
          palette,
        )
        break

      case 'year':
        drawYear(ctx, block.y, block.year, block.count, plan.tier, palette)
        break

      case 'row':
        await drawPoster(
          ctx,
          block.record.posterKey,
          toImagePx(20),
          block.y + plan.tier.padY,
          plan.tier.posterW,
          plan.tier.posterH,
          toImagePx(6),
          palette,
        )
        drawTimelineRow(ctx, block, plan.tier, palette)
        onProgress?.(++done, posterBlocks.length)
        break

      case 'cell':
        await drawPoster(
          ctx,
          block.record.posterKey,
          block.x,
          block.y,
          block.w,
          plan.tier.posterH,
          toImagePx(6),
          palette,
        )
        drawGridCell(ctx, block.x, block.y, plan.tier, block.record, palette)
        onProgress?.(++done, posterBlocks.length)
        break
    }
  }

  if (plan.included === 0) {
    drawEmpty(ctx, toImagePx(24 + 92 + 16), palette)
  }
}
