import { TmdbError } from '../tmdb/client'
import { loadTmdbConfig } from '../tmdb/settings'

export type IngestedPoster = {
  blob: Blob
  mimeType: string
  width: number
  height: number
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality)
  })
}

/**
 * 缩放 + 转码，产出可以直接存进 IndexedDB 的图。
 *
 * ⚠️ WebKit（含 iOS 17）**没有 canvas WebP 编码器**：传 'image/webp' 会
 * 静默返回 PNG，不报错也不 reject。必须检出 `out.type` 并显式回退 JPEG——
 * 否则一张 400px 的海报可能大 5–10 倍，几十张就把配额吃出可观的一块。
 */
export async function ingestPoster(
  src: Blob,
  maxWidth = 400,
): Promise<IngestedPoster> {
  const bitmap = await createImageBitmap(src)
  try {
    const scale = Math.min(1, maxWidth / bitmap.width)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas 上下文')
    ctx.drawImage(bitmap, 0, 0, width, height)

    let out = await canvasToBlob(canvas, 'image/webp', 0.82)
    if (!out || out.type !== 'image/webp') {
      out = await canvasToBlob(canvas, 'image/jpeg', 0.85)
    }
    if (!out) throw new Error('海报转码失败')

    return { blob: out, mimeType: out.type, width, height }
  } finally {
    bitmap.close?.()
  }
}

/**
 * 从图床下载海报。
 *
 * 只在「添加影片」时调用。运行时列表页只读本地 Blob，绝不请求 TMDB CDN——
 * image.tmdb.org 裸连是被拦的，运行时依赖它会让封面全挂。
 */
export async function fetchPoster(
  posterPath: string,
  size = 'w342',
): Promise<Blob> {
  const cfg = loadTmdbConfig()
  const url = `${cfg.imageBase.replace(/\/+$/, '')}/${size}${posterPath}`

  const ac = new AbortController()
  const timer = window.setTimeout(() => ac.abort(), 15_000)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) {
      throw new TmdbError(`海报下载失败 HTTP ${res.status}`, 'http', res.status)
    }
    return await res.blob()
  } catch (e) {
    if (e instanceof TmdbError) throw e
    throw new TmdbError(
      '海报下载失败：网络不通，或代理没有返回 CORS 头',
      'unreachable',
    )
  } finally {
    window.clearTimeout(timer)
  }
}

/** 下载 + 转码一步到位 */
export async function fetchAndIngestPoster(
  posterPath: string,
): Promise<IngestedPoster> {
  return ingestPoster(await fetchPoster(posterPath))
}

/** 由 poster_path 拼出可直接预览的 URL（仅在挂了代理时可用） */
export function posterPreviewUrl(posterPath: string, size = 'w92'): string {
  const cfg = loadTmdbConfig()
  return `${cfg.imageBase.replace(/\/+$/, '')}/${size}${posterPath}`
}
