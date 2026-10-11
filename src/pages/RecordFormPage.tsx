import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Segmented from '../components/Segmented'
import StarPicker from '../components/StarPicker'
import TmdbSearchPanel, { type SearchHit } from '../components/TmdbSearchPanel'
import { ChevronLeftIcon } from '../components/icons'
import { db } from '../db/db'
import { putPoster } from '../db/posters'
import { createRecord, updateRecord } from '../db/records'
import type { NewRecord } from '../db/types'
import { usePosterUrl } from '../hooks/usePosterUrl'
import { fetchAndIngestPoster } from '../media/poster'
import {
  HALL_FORMATS,
  VERSION_TYPES,
  type HallFormat,
  type VersionType,
} from '../lib/constants'

function todayISO() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-meta mb-2 px-1 font-medium text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  children,
  stacked,
}: {
  label: string
  children: ReactNode
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className="px-4 py-3.5">
        <span className="text-meta mb-2 block text-muted">{label}</span>
        {children}
      </div>
    )
  }
  return (
    <label className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-body w-[64px] shrink-0 text-ink">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  )
}

// ⚠️ 必须是 16px（text-base），不能是 14px 的 text-body。
// iOS 在聚焦字号小于 16px 的输入框时会自动放大整个页面，每次都缩放。
// 不能用 maximum-scale=1 去堵——那会连带禁掉用户手动缩放，是无障碍上的倒退。
const inputCls =
  'text-base w-full bg-transparent text-ink placeholder:text-muted focus:outline-none'

/** 影院输入 + 从已有记录里学来的自动补全 */
function CinemaInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const known = useLiveQuery(async () => {
    const rows = await db.records.toArray()
    const set = new Set<string>()
    for (const r of rows) if (!r.deletedAt && r.cinema.trim()) set.add(r.cinema.trim())
    return [...set].sort()
  }, [])

  const matches = useMemo(() => {
    const list = known ?? []
    const q = value.trim()
    const pool = q ? list.filter((c) => c.includes(q) && c !== q) : list
    return pool.slice(0, 6)
  }, [known, value])

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        placeholder="输入几个字会带出以前填过的"
        className={inputCls}
      />
      {open && matches.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-line bg-canvas shadow-lg">
          {matches.map((c) => (
            <li key={c}>
              <button
                type="button"
                // mousedown 早于 blur，preventDefault 可避免输入框先失焦导致点不中
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
                className="text-body block w-full px-3 py-2 text-left text-ink transition-opacity active:opacity-55"
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function RecordFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)

  const existing = useLiveQuery(async () => {
    if (!id) return undefined
    return await db.records.get(id)
  }, [id])

  const [title, setTitle] = useState('')
  const [originalTitle, setOriginalTitle] = useState('')
  const [year, setYear] = useState('')
  const [tmdbId, setTmdbId] = useState<number | null>(null)
  const [posterKey, setPosterKey] = useState<string | undefined>()

  const [watchedOn, setWatchedOn] = useState(todayISO)
  const [cinema, setCinema] = useState('')
  const [hallFormat, setHallFormat] = useState<HallFormat>('普通')
  const [versionType, setVersionType] = useState<VersionType>('原版字幕')

  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [rewatch, setRewatch] = useState(0)

  /** 新选中的海报，保存时才落库——避免用户中途放弃留下孤儿数据 */
  const [pending, setPending] = useState<{ blob: Blob; mimeType: string } | null>(
    null,
  )
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [fetchingPoster, setFetchingPoster] = useState(false)
  const [posterNote, setPosterNote] = useState<string>()

  // 编辑模式：只在首次拿到数据时回填，之后的用户输入不被覆盖
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!existing || hydratedRef.current) return
    hydratedRef.current = true
    setTitle(existing.title)
    setOriginalTitle(existing.originalTitle ?? '')
    setYear(existing.year === null ? '' : String(existing.year))
    setTmdbId(existing.tmdbId)
    setPosterKey(existing.posterKey)
    setWatchedOn(existing.watchedOn)
    setCinema(existing.cinema)
    setHallFormat(existing.hallFormat)
    setVersionType(existing.versionType)
    setRating(existing.rating ?? 0)
    setReview(existing.review)
    setRewatch(existing.rewatchCount)
  }, [existing])

  useEffect(() => {
    if (!pending) {
      setPreviewUrl(undefined)
      return
    }
    const u = URL.createObjectURL(pending.blob)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [pending])

  const valid = title.trim().length > 0

  async function applyHit(hit: SearchHit) {
    setTitle(hit.title)
    setOriginalTitle(hit.originalTitle)
    setYear(hit.year === null ? '' : String(hit.year))
    setTmdbId(hit.tmdbId)
    setPosterNote(undefined)

    if (!hit.posterPath) {
      // 有些片子 TMDB 上没有海报，这很正常，不是错误
      setPending(null)
      return
    }

    setFetchingPoster(true)
    try {
      // 下载 → canvas 转码 → 存本地。
      // 之后的列表页只读本地 Blob，绝不再请求 TMDB CDN。
      const ingested = await fetchAndIngestPoster(hit.posterPath)
      setPending({ blob: ingested.blob, mimeType: ingested.mimeType })
    } catch (e) {
      setPending(null)
      setPosterNote(e instanceof Error ? e.message : '海报抓取失败')
    } finally {
      setFetchingPoster(false)
    }
  }

  async function handleSave() {
    if (!valid) return

    const payload: NewRecord = {
      tmdbId,
      title: title.trim(),
      originalTitle: originalTitle.trim() || undefined,
      year: year ? Number(year) : null,
      posterKey,
      watchedOn,
      cinema: cinema.trim(),
      hallFormat,
      versionType,
      rating: rating > 0 ? rating : null,
      review: review.trim(),
      rewatchCount: rewatch,
    }

    const targetId = editing && id ? id : await createRecord(payload)

    if (editing && id) await updateRecord(id, payload)

    // 海报与记录一对一，直接用记录 id 当海报主键
    if (pending) {
      await putPoster({
        key: targetId,
        blob: pending.blob,
        mimeType: pending.mimeType,
        width: 0,
        height: 0,
      })
      await updateRecord(targetId, { posterKey: targetId })
    }

    navigate(`/record/${targetId}`, { replace: true })
  }

  if (editing && existing === undefined) return null

  return (
    <div className="anim-slide-in min-h-full bg-canvas">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="flex items-center gap-1 px-2.5 pt-2 pb-2.5">
          <button
            type="button"
            aria-label="返回"
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-ink transition-opacity active:opacity-55"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <h1 className="text-title flex-1 text-ink">
            {editing ? '编辑记录' : '添加记录'}
          </h1>
          <button
            type="button"
            disabled={!valid}
            onClick={handleSave}
            className={`text-meta rounded-lg px-3.5 py-1.5 font-semibold transition-opacity duration-150 ${
              valid
                ? 'bg-ink text-canvas active:opacity-70'
                : 'bg-surface-2 text-muted'
            }`}
          >
            保存
          </button>
        </div>
      </header>

      <div className="px-5 pt-5">
        <Section title="从 TMDB 搜索">
          <div className="p-3">
            <TmdbSearchPanel onPick={applyHit} />
          </div>
        </Section>

        <p className="text-meta mb-6 -mt-3 px-1 text-muted">
          搜不到也可以直接往下手动填写，两者不冲突。
        </p>

        <Section title="影片">
          <div className="flex items-center gap-4 px-4 py-3.5">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="h-[88px] w-[59px] shrink-0 rounded-md object-cover"
              />
            ) : posterKey ? (
              <PosterThumb posterKey={posterKey} />
            ) : (
              <div className="text-meta flex h-[88px] w-[59px] shrink-0 items-center justify-center rounded-md border border-dashed border-line text-muted">
                {fetchingPoster ? '抓取中' : '海报'}
              </div>
            )}
            <p className="text-meta leading-relaxed text-muted">
              {posterNote ? (
                <span className="text-red-500">{posterNote}</span>
              ) : fetchingPoster ? (
                '正在下载海报…'
              ) : previewUrl || posterKey ? (
                '海报会在保存时存进本地，之后看列表不再联网取图。'
              ) : (
                '从上方搜索选一部片会自动带出海报，也可以不填。'
              )}
            </p>
          </div>

          <Field label="片名">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="必填"
              className={inputCls}
            />
          </Field>
          <Field label="原名">
            <input
              value={originalTitle}
              onChange={(e) => setOriginalTitle(e.target.value)}
              placeholder="选填"
              className={inputCls}
            />
          </Field>
          <Field label="年份">
            <input
              value={year}
              onChange={(e) =>
                setYear(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              inputMode="numeric"
              placeholder="选填"
              className={`${inputCls} tabular-nums`}
            />
          </Field>
        </Section>

        <Section title="观影">
          <Field label="日期">
            <input
              type="date"
              value={watchedOn}
              onChange={(e) => setWatchedOn(e.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
          <Field label="影院">
            <CinemaInput value={cinema} onChange={setCinema} />
          </Field>
          <Field label="影厅" stacked>
            <Segmented
              options={HALL_FORMATS}
              value={hallFormat}
              onChange={setHallFormat}
            />
          </Field>
          <Field label="版本" stacked>
            <Segmented
              options={VERSION_TYPES}
              value={versionType}
              onChange={setVersionType}
            />
          </Field>
        </Section>

        <Section title="评价">
          <Field label="评分" stacked>
            <div className="flex items-center gap-3">
              <StarPicker value={rating} onChange={setRating} />
              <span className="text-meta tabular-nums text-muted">
                {rating > 0 ? `${rating.toFixed(1)} 分` : '未评'}
              </span>
            </div>
          </Field>
          <Field label="短评" stacked>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={3}
              placeholder="选填"
              className={`${inputCls} resize-none leading-relaxed`}
            />
          </Field>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-body text-ink">重看次数</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRewatch((n) => Math.max(0, n - 1))}
                className="text-title size-7 rounded-md bg-surface-2 leading-none text-ink-2 transition-opacity active:opacity-55"
              >
                −
              </button>
              <span className="text-body w-4 text-center tabular-nums text-ink">
                {rewatch}
              </span>
              <button
                type="button"
                onClick={() => setRewatch((n) => Math.min(99, n + 1))}
                className="text-title size-7 rounded-md bg-surface-2 leading-none text-ink-2 transition-opacity active:opacity-55"
              >
                +
              </button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

function PosterThumb({ posterKey }: { posterKey: string }) {
  const url = usePosterUrl(posterKey)
  if (!url) {
    return (
      <div className="flex h-[88px] w-[59px] shrink-0 items-center justify-center rounded-md border border-dashed border-line text-muted">
        <span className="text-meta">海报</span>
      </div>
    )
  }
  return (
    <img
      src={url}
      alt=""
      className="h-[88px] w-[59px] shrink-0 rounded-md object-cover"
    />
  )
}
