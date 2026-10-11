import { listRecords } from '../db/records'
import { maxCanvasHeight } from './limits'
import { IMAGE_WIDTH, planShare, type ShareView } from './layout'
import { renderPlan } from './render'

/**
 * 生成分享长图。
 *
 * 串起来就四步：取数据 → 实测本机能画多高 → 排版 → 画 → 编码。
 * 顺序不能换：不先探测上限，排版就不知道该压多紧；排完再改尺寸，
 * 等于白画一遍。
 */

export type ShareImageResult = {
  blob: Blob
  /** 库里一共几条 */
  total: number
  /** 图上实际画了几条 */
  included: number
  /** 没装下、被截掉了 */
  truncated: boolean
}

export type GenerateOptions = {
  onProgress?: (done: number, total: number) => void
}

export async function generateShareImage(
  view: ShareView,
  opts: GenerateOptions = {},
): Promise<ShareImageResult> {
  const records = await listRecords()

  const maxHeight = maxCanvasHeight()
  const plan = planShare(records, view, maxHeight)

  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_WIDTH
  canvas.height = plan.height

  try {
    await renderPlan(canvas, plan, opts.onProgress)

    const blob = await new Promise<Blob | null>((resolve) => {
      // 用 PNG 而不是 WebP：iOS 的 canvas 没有 WebP 编码器，
      // 传 'image/webp' 会静默返回 PNG（见 src/media/poster.ts 里的记录）。
      // PNG 到处都支持，这里没有回退的必要，但 blob 仍可能是 null。
      canvas.toBlob(resolve, 'image/png')
    })
    if (!blob) throw new Error('图片编码失败')

    return {
      blob,
      total: plan.total,
      included: plan.included,
      truncated: plan.truncated,
    }
  } finally {
    // 必须手工释放。iOS 有一条「canvas 总内存」限制，这块 1080×N 的画布
    // 留着不放，下一次生成就会莫名其妙地失败。
    canvas.width = 0
    canvas.height = 0
  }
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

export const shareImageFilename = (d?: Date) => `reelog-${stamp(d)}.png`
