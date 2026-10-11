import { hasKey, isV4Token, loadTmdbConfig, type TmdbConfig } from './settings'

export type TmdbErrorKind =
  | 'no-key'
  | 'timeout'
  | 'unreachable'
  | 'auth'
  | 'http'

export class TmdbError extends Error {
  // 不用「构造函数参数属性」那种简写：它会生成运行时代码，
  // 而 tsconfig 里的 erasableSyntaxOnly 要求类型标记必须可以被纯擦除。
  readonly kind: TmdbErrorKind
  readonly status?: number

  constructor(message: string, kind: TmdbErrorKind, status?: number) {
    super(message)
    this.name = 'TmdbError'
    this.kind = kind
    this.status = status
  }
}

export type TmdbMovie = {
  id: number
  title: string
  original_title: string
  release_date?: string
  poster_path: string | null
  overview?: string
}

const REQUEST_TIMEOUT_MS = 8000

/**
 * 组合「调用方给的取消信号」和「超时」。
 *
 * 不用 AbortSignal.any / AbortSignal.timeout 是因为它们要求较新的 Safari
 * （iOS 17.0 上未必都有）。手写组合没有兼容性风险。
 */
async function request<T>(
  path: string,
  params: Record<string, string> = {},
  external?: AbortSignal,
): Promise<T> {
  const cfg = loadTmdbConfig()
  if (!hasKey(cfg)) {
    throw new TmdbError('未配置 TMDB API Key', 'no-key')
  }

  const url = new URL(cfg.apiBase.replace(/\/+$/, '') + path)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }

  const headers: Record<string, string> = { accept: 'application/json' }
  // v3 走 query 参数，v4 走 Bearer 头，两种都支持
  if (isV4Token(cfg.apiKey)) headers.Authorization = `Bearer ${cfg.apiKey.trim()}`
  else url.searchParams.set('api_key', cfg.apiKey.trim())

  const ac = new AbortController()
  const timer = window.setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS)
  if (external) {
    if (external.aborted) ac.abort()
    else external.addEventListener('abort', () => ac.abort(), { once: true })
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { headers, signal: ac.signal })
  } catch {
    // fetch 抛 TypeError 时无法区分「网络不通」和「被 CORS 拦下」——
    // 浏览器出于安全考虑不暴露这个区别。所以提示里两种可能都要提。
    if (ac.signal.aborted && !external?.aborted) {
      throw new TmdbError('请求超时', 'timeout')
    }
    throw new TmdbError(
      '请求失败：可能是网络不通，也可能是代理没有返回 CORS 头',
      'unreachable',
    )
  } finally {
    window.clearTimeout(timer)
  }

  if (res.status === 401) {
    throw new TmdbError('API Key 无效或已失效', 'auth', 401)
  }
  if (!res.ok) {
    throw new TmdbError(`TMDB 返回 HTTP ${res.status}`, 'http', res.status)
  }

  return (await res.json()) as T
}

export async function searchMovies(
  query: string,
  signal?: AbortSignal,
): Promise<TmdbMovie[]> {
  const cfg = loadTmdbConfig()
  const data = await request<{ results: TmdbMovie[] }>(
    '/search/movie',
    { query, language: cfg.lang, include_adult: 'false' },
    signal,
  )
  return data.results ?? []
}

/**
 * 探测连通性。
 *
 * 探的是**用户配置的 apiBase**，不是硬编码的 api.themoviedb.org——
 * 后者在国内必然失败，那探测就没意义了。
 */
export async function probe(cfg: TmdbConfig): Promise<void> {
  if (!hasKey(cfg)) throw new TmdbError('未配置 API Key', 'no-key')

  const url = new URL(cfg.apiBase.replace(/\/+$/, '') + '/configuration')
  const headers: Record<string, string> = { accept: 'application/json' }
  if (isV4Token(cfg.apiKey)) headers.Authorization = `Bearer ${cfg.apiKey.trim()}`
  else url.searchParams.set('api_key', cfg.apiKey.trim())

  const ac = new AbortController()
  const timer = window.setTimeout(() => ac.abort(), 5000)
  try {
    const res = await fetch(url.toString(), { headers, signal: ac.signal })
    if (res.status === 401) throw new TmdbError('API Key 无效', 'auth', 401)
    if (!res.ok) throw new TmdbError(`HTTP ${res.status}`, 'http', res.status)
  } catch (e) {
    if (e instanceof TmdbError) throw e
    if (ac.signal.aborted) throw new TmdbError('超时', 'timeout')
    throw new TmdbError('连不上，或代理没有返回 CORS 头', 'unreachable')
  } finally {
    window.clearTimeout(timer)
  }
}
