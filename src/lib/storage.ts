/**
 * 存储相关的能力探测。
 *
 * Storage API 各浏览器支持不一（Safari 尤其），所以全部走 feature-detect，
 * 任何功能都不得依赖 persist() 返回 true。
 */

type MaybeStorage = Partial<StorageManager>

function sm(): MaybeStorage {
  if (typeof navigator === 'undefined') return {}
  return (navigator.storage as MaybeStorage | undefined) ?? {}
}

/** 是否以「已安装的 Web App」方式运行（iOS 上即从主屏幕图标打开） */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const byMedia = window.matchMedia?.('(display-mode: standalone)').matches === true
  // iOS Safari 的专有属性，TS 标准库里没有
  const byNavigator =
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return byMedia || byNavigator
}

export function persistSupported(): boolean {
  return typeof sm().persist === 'function'
}

export type StorageSnapshot = {
  usage: number | null
  quota: number | null
  /** null 表示该浏览器不支持查询（不是「未持久化」） */
  persisted: boolean | null
}

export async function readStorage(): Promise<StorageSnapshot> {
  const s = sm()

  let usage: number | null = null
  let quota: number | null = null
  if (typeof s.estimate === 'function') {
    try {
      const est = await s.estimate()
      usage = est.usage ?? null
      quota = est.quota ?? null
    } catch {
      /* 忽略：读不到就显示 — */
    }
  }

  let persisted: boolean | null = null
  if (typeof s.persisted === 'function') {
    try {
      persisted = await s.persisted()
    } catch {
      /* 同上 */
    }
  }

  return { usage, quota, persisted }
}

/** 申请持久模式。返回 null 表示浏览器不支持，false 表示被拒绝。 */
export async function requestPersist(): Promise<boolean | null> {
  const s = sm()
  if (typeof s.persist !== 'function') return null
  try {
    return await s.persist()
  } catch {
    return null
  }
}

export function formatBytes(n: number | null): string {
  if (n === null) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}
