/**
 * TMDB 配置。
 *
 * 存在 localStorage 而不是 IndexedDB：它是配置不是数据，需要在渲染前
 * 同步读到，而且**绝不能进仓库**——仓库里零密钥是这个项目的硬要求。
 */

export const DEFAULT_API_BASE = 'https://api.themoviedb.org/3'
export const DEFAULT_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export type TmdbConfig = {
  /** v3 API Key（32 位十六进制）或 v4 Read Access Token（JWT） */
  apiKey: string
  /** 可覆盖。裸连不通时指向自己的代理。 */
  apiBase: string
  /** 同上，海报图床也能覆盖 */
  imageBase: string
  lang: string
}

export const TMDB_DEFAULTS: TmdbConfig = {
  apiKey: '',
  apiBase: DEFAULT_API_BASE,
  imageBase: DEFAULT_IMAGE_BASE,
  lang: 'zh-CN',
}

const STORAGE_KEY = 'reelog.tmdb'

export function loadTmdbConfig(): TmdbConfig {
  if (typeof localStorage === 'undefined') return { ...TMDB_DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...TMDB_DEFAULTS }
    return { ...TMDB_DEFAULTS, ...(JSON.parse(raw) as Partial<TmdbConfig>) }
  } catch {
    return { ...TMDB_DEFAULTS }
  }
}

export function saveTmdbConfig(patch: Partial<TmdbConfig>): TmdbConfig {
  const next = { ...loadTmdbConfig(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* 隐私模式 / 配额满：忽略，本次会话内仍然生效 */
  }
  return next
}

/** v4 的 Read Access Token 是 JWT，以 eyJ 开头；v3 的 API Key 是 32 位十六进制。 */
export function isV4Token(key: string): boolean {
  return key.trim().startsWith('eyJ')
}

export const hasKey = (c: TmdbConfig) => c.apiKey.trim().length > 0

export const usingCustomBase = (c: TmdbConfig) =>
  c.apiBase.replace(/\/+$/, '') !== DEFAULT_API_BASE ||
  c.imageBase.replace(/\/+$/, '') !== DEFAULT_IMAGE_BASE
