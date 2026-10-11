import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Poster from '../components/Poster'
import RatingStars from '../components/RatingStars'
import RecordDetailBody from '../components/RecordDetailBody'
import ShareImageDialog from '../components/ShareImageDialog'
import { GridIcon, ListIcon, ShareIcon } from '../components/icons'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useRecords } from '../hooks/useRecords'
import type { WatchRecord } from '../db/types'

type View = 'timeline' | 'grid'

/** 错落进入的延迟上限：第 7 项之后不再累加，否则末尾要等太久 */
const STAGGER_MS = 16
const STAGGER_CAP = 6

const stagger = (i: number) => ({
  animationDelay: `${Math.min(i, STAGGER_CAP) * STAGGER_MS}ms`,
})

function TimelineRow({
  r,
  index,
  onSelect,
}: {
  r: WatchRecord
  index: number
  onSelect?: (id: string) => void
}) {
  const [, month, day] = r.watchedOn.split('-')

  const extras = [
    `${Number(month)}月${Number(day)}日`,
    r.versionType !== '原版字幕' ? r.versionType : null,
    r.rewatchCount > 0 ? `重看 ${r.rewatchCount}` : null,
  ].filter(Boolean)

  return (
    <Link
      to={`/record/${r.id}`}
      style={stagger(index)}
      onClick={onSelect ? (e) => { e.preventDefault(); onSelect(r.id) } : undefined}
      className="anim-fade-up flex gap-4 py-3.5 transition-opacity duration-150 active:opacity-55"
    >
      <Poster
        posterKey={r.posterKey}
        className="h-[84px] w-[56px] shrink-0 rounded-md"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <h3 className="text-title truncate text-ink">{r.title}</h3>
          {r.year !== null && (
            <span className="text-meta shrink-0 tabular-nums text-muted">
              {r.year}
            </span>
          )}
        </div>

        <p className="text-body mt-0.5 truncate text-ink-2">
          {r.cinema || <span className="text-muted">未填影院</span>}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-1.5">
          <span className="text-meta shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-ink-2">
            {r.hallFormat}
          </span>
          <span className="text-meta truncate text-muted">
            {extras.join(' · ')}
          </span>
          {r.rating !== null && (
            <span className="ml-auto shrink-0 pl-2">
              <RatingStars value={r.rating} />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function GridCard({
  r,
  index,
  onSelect,
}: {
  r: WatchRecord
  index: number
  onSelect?: (id: string) => void
}) {
  return (
    <Link
      to={`/record/${r.id}`}
      style={stagger(index)}
      onClick={onSelect ? (e) => { e.preventDefault(); onSelect(r.id) } : undefined}
      className="anim-fade-up block transition-opacity duration-150 active:opacity-55"
    >
      <Poster
        posterKey={r.posterKey}
        className="aspect-[2/3] w-full rounded-lg"
      />
      <h3 className="text-meta mt-2 truncate font-medium text-ink">{r.title}</h3>
      {r.rating !== null && (
        <div className="mt-1">
          <RatingStars value={r.rating} size={10} />
        </div>
      )}
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="px-6 pt-24 text-center">
      <p className="text-title text-ink">还没有记录</p>
      <p className="text-meta mt-2 leading-relaxed text-muted">
        点右下角的 + 记下第一部。
        <br />
        没有网络也能记，之后再补海报。
      </p>
    </div>
  )
}

export default function DiaryPage() {
  const [view, setView] = useLocalStorage<View>('reelog.view', 'timeline')
  const records = useRecords()
  const isDesktop = useIsDesktop()
  const [shareOpen, setShareOpen] = useState(false)

  // 桌面端用本地状态记住"右栏看的是哪条"。
  // 走 URL 的话，每次点击都会触发路由切换、列表重新挂载，
  // 错落动画会一遍遍重放——得不偿失。
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 进桌面布局时默认选中第一条，右栏不至于是空的
  useEffect(() => {
    if (!isDesktop) return
    if (selectedId && records.some((r) => r.id === selectedId)) return
    setSelectedId(records[0]?.id ?? null)
  }, [isDesktop, records, selectedId])

  const order = useMemo(
    () => new Map(records.map((r, i) => [r.id, i])),
    [records],
  )

  const groups = useMemo(() => {
    const m = new Map<string, WatchRecord[]>()
    for (const r of records) {
      const y = r.watchedOn.slice(0, 4)
      const list = m.get(y)
      if (list) list.push(r)
      else m.set(y, [r])
    }
    return [...m.entries()]
  }, [records])

  const screenings = records.reduce((n, r) => n + 1 + r.rewatchCount, 0)
  const selected = isDesktop
    ? (records.find((r) => r.id === selectedId) ?? null)
    : null
  const onSelect = isDesktop ? setSelectedId : undefined

  const toggle = (
    <div className="flex shrink-0 rounded-xl bg-surface-2 p-1">
      {(
        [
          ['timeline', ListIcon, '时间线'],
          ['grid', GridIcon, '海报墙'],
        ] as const
      ).map(([key, Icon, label]) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={view === key}
          onClick={() => setView(key)}
          className={`rounded-lg px-3.5 py-3 transition-colors duration-150 ${
            view === key ? 'bg-canvas text-ink shadow-sm' : 'text-muted'
          }`}
        >
          <Icon size={19} />
        </button>
      ))}
    </div>
  )

  // 视图切换 + 生成分享长图。两处 header 共用，避免桌面和移动端长得不一样。
  const actions = (
    <div className="flex shrink-0 items-center gap-2">
      {toggle}
      <div className="flex rounded-xl bg-surface-2 p-1">
        <button
          type="button"
          aria-label="生成分享长图"
          onClick={() => setShareOpen(true)}
          className="rounded-lg px-3.5 py-3 text-muted transition-colors duration-150 active:opacity-55"
        >
          <ShareIcon size={19} />
        </button>
      </div>
    </div>
  )

  const listBody =
    records.length === 0 ? (
      <EmptyState />
    ) : view === 'timeline' ? (
      <div>
        {groups.map(([year, list]) => (
          <section key={year} className="mt-5 first:mt-3">
            <h2 className="text-meta mb-1 font-medium text-muted">
              {year}
              <span className="ml-2 opacity-60">{list.length} 部</span>
            </h2>
            <div className="divide-y divide-line">
              {list.map((r) => (
                <TimelineRow
                  key={r.id}
                  r={r}
                  index={order.get(r.id) ?? 0}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    ) : (
      <div
        className={`grid gap-x-3 gap-y-6 pt-3 ${
          isDesktop ? 'grid-cols-3' : 'grid-cols-3'
        }`}
      >
        {records.map((r) => (
          <GridCard
            key={r.id}
            r={r}
            index={order.get(r.id) ?? 0}
            onSelect={onSelect}
          />
        ))}
      </div>
    )

  /* ---------------- 桌面：左列表 + 右详情 ---------------- */
  if (isDesktop) {
    return (
      <div className="flex h-dvh">
        <div className="flex w-[420px] shrink-0 flex-col border-r border-line">
          <header className="shrink-0 border-b border-line px-5 pt-5 pb-4">
            <h1 className="text-display text-ink">Reelog</h1>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-meta text-muted">
                {records.length} 部 · {screenings} 场
              </p>
              {records.length > 0 && actions}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {listBody}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selected ? (
            <div className="mx-auto max-w-2xl px-8 py-8">
              <RecordDetailBody
                record={selected}
                onDeleted={() => setSelectedId(null)}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-8">
              <p className="text-body text-muted">
                {records.length === 0
                  ? '还没有记录，点右下角 + 添加第一部'
                  : '从左侧选一部片看详情'}
              </p>
            </div>
          )}
        </div>

        {/* fixed 定位、脱离文档流，放在这个 flex 容器里不影响布局 */}
        {shareOpen && (
          <ShareImageDialog view={view} onClose={() => setShareOpen(false)} />
        )}
      </div>
    )
  }

  /* ---------------- 移动：单栏 ---------------- */
  return (
    <>
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="flex items-end justify-between px-5 pt-4 pb-3.5">
          <div>
            <h1 className="text-display text-ink">Reelog</h1>
            <p className="text-meta mt-1 text-muted">
              {records.length} 部 · {screenings} 场
            </p>
          </div>
          {records.length > 0 && actions}
        </div>
      </header>

      {records.length === 0 ? (
        <EmptyState />
      ) : (
        <div key={view} className="px-5 pt-1">
          {listBody}
        </div>
      )}

      {shareOpen && (
        <ShareImageDialog view={view} onClose={() => setShareOpen(false)} />
      )}
    </>
  )
}
