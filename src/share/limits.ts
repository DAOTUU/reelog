import { IMAGE_WIDTH } from './layout'

/**
 * 分享长图的画布尺寸上限。
 *
 * ⚠️ iOS 上 canvas 有硬上限，而且**超限时不抛异常、不报错、getContext 也
 * 照样返回对象——只是画什么进去都落到虚空，读出来是全空白**。这个坑最恶心的
 * 地方就在这儿：你完全不知道出错了，只会拿到一张纯白的图。
 *
 * 已知数值：
 *   iOS 17 及更早：单边 4096、总面积 16,777,216
 *   iOS 18 起：    单边 8192、总面积 67,108,864
 *   安卓 Chrome：  普遍更高
 *
 * 所以不硬编码。写死 4096 会在 iOS 18 和安卓上白白浪费一半以上的清晰度；
 * 写死 8192 在 iOS 17 上会直接产出白图。唯一可靠的办法是实测。
 */

/**
 * 候选高度，从高到低试。
 *
 * 不是均匀取点：刻意把 4096 和 8192 这两个已知的档位放进去，
 * 命中时就直接是设备真实的边界值，不用再做二分。
 */
const CANDIDATES = [16000, 8192, 6000, 4096, 3000]

/** 全部候选都失败时的退路。这个值在任何现代浏览器上都画得出来。 */
const FALLBACK = 3000

let cached: number | undefined

function canUseHeight(height: number): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_WIDTH
  canvas.height = height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    // 判据只能是「画下去再读回来」。超限时这里读到的是全透明。
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 1, 1)
    const alpha = ctx.getImageData(0, 0, 1, 1).data[3]
    return alpha === 255
  } catch {
    // 有些实现在读像素时才炸（IndexSizeError / SecurityError）
    return false
  } finally {
    // 立刻释放。iOS 另有一条「canvas 总内存」限制，探测本身不能把它撑爆，
    // 否则紧接着的正式绘制会莫名其妙地失败。
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * 实测本设备能画多高（图像像素）。结果缓存，一个会话只探一次。
 */
export function maxCanvasHeight(): number {
  if (cached !== undefined) return cached

  // 测试环境是 node，没有 document。这里返回退路值而不是抛错，
  // 免得将来有人写了带 DOM 的测试被这个函数绊倒。
  if (typeof document === 'undefined') {
    cached = FALLBACK
    return cached
  }

  for (const h of CANDIDATES) {
    if (canUseHeight(h)) {
      cached = h
      return h
    }
  }

  cached = FALLBACK
  return cached
}

/** 仅供测试重置缓存 */
export function resetMaxCanvasHeightCache(): void {
  cached = undefined
}
