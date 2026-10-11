import { useEffect, useState } from 'react'
import { posterPreviewUrl } from '../media/poster'
import { searchMovies, TmdbError, type TmdbMovie } from '../tmdb/client'
import { statusMessage, useTmdbStatus } from '../tmdb/availability'
import { SearchIcon } from './icons'

export type SearchHit = {
  tmdbId: number
  title: string
  originalTitle: string
  year: number | null
  posterPath: string | null
}

const yearOf = (m: TmdbMovie): number | null => {
  const y = m.release_date?.slice(0, 4)
  return y && /^\d{4}$/.test(y) ? Number(y) : null
}

function StatusNote({
  message,
  retry,
}: {
  message: string | null
  retry?: () => void
}) {
  if (!message) return null
  return (
    <p className="text-meta border-l-2 border-accent bg-surface-2 flex items-start gap-2 py-2 pr-3 pl-2.5 text-ink-2">
      <span className="flex-1">{message}</span>
      {retry && (
        <button type="button" onClick={retry} className="shrink-0 text-accent">
          重试
        </button>
      )}
    </p>
  )
}

export default function TmdbSearchPanel({
  onPick,
}: {
  onPick: (hit: SearchHit) => void
}) {
  const availability = useTmdbStatus()
  const message = statusMessage(availability)
  const canSearch = availability.status === 'ok'

  const [q, setQ] = useState('')
  const [hits, setHits] = useState<TmdbMovie[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const keyword = q.trim()
    if (!canSearch || !keyword) {
      setHits([])
      return
    }

    const ac = new AbortController()
    // 输入防抖：每敲一个字就发请求既浪费配额也容易乱序返回
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError(undefined)
      try {
        setHits(await searchMovies(keyword, ac.signal))
      } catch (e) {
        if (!ac.signal.aborted) {
          setError(e instanceof TmdbError ? e.message : '搜索失败')
          setHits([])
        }
      } finally {
        if (!ac.signal.aborted) setSearching(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [q, canSearch])

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5">
        <SearchIcon className="shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          // 刻意不用 disabled：iOS 上被禁用的输入框点了完全不弹键盘，
          // 用户只会觉得"卡住了"，不知道是为什么。宁可让它能点能输入，
          // 由下面的提示条解释为什么搜不出结果。
          placeholder={
            canSearch ? '搜索影片，自动带出海报和年份' : '搜索当前不可用'
          }
          className="text-body w-full bg-transparent text-ink placeholder:text-muted focus:outline-none"
        />
        {searching && <span className="text-meta shrink-0 text-muted">搜索中…</span>}
      </div>

      <div className="mt-2.5">
        <StatusNote
          message={error ?? message}
          retry={
            availability.status === 'unreachable' ||
            availability.status === 'bad-key'
              ? availability.recheck
              : error
                ? () => setQ((v) => v)
                : undefined
          }
        />
      </div>

      {canSearch && hits.length > 0 && (
        <ul className="mt-2.5 divide-y divide-line">
          {hits.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    tmdbId: m.id,
                    title: m.title,
                    originalTitle: m.original_title,
                    year: yearOf(m),
                    posterPath: m.poster_path,
                  })
                }
                className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity duration-150 active:opacity-55"
              >
                {m.poster_path ? (
                  <img
                    src={posterPreviewUrl(m.poster_path)}
                    alt=""
                    loading="lazy"
                    className="h-[60px] w-10 shrink-0 rounded-md bg-surface-2 object-cover"
                  />
                ) : (
                  <div className="h-[60px] w-10 shrink-0 rounded-md bg-surface-2" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-body block truncate font-medium text-ink">
                    {m.title}
                  </span>
                  <span className="text-meta block truncate text-muted">
                    {m.original_title}
                    {yearOf(m) !== null && ` · ${yearOf(m)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canSearch && q.trim() && !searching && hits.length === 0 && !error && (
        <p className="text-meta mt-2.5 px-1 text-muted">
          没找到匹配。可以直接手动填写下方表单。
        </p>
      )}
    </div>
  )
}
