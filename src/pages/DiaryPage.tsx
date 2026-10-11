import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Poster from '../components/Poster'
import RatingStars from '../components/RatingStars'
import { GridIcon, ListIcon } from '../components/icons'
import { useRecords } from '../hooks/useRecords'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { WatchRecord } from '../db/types'

type View = 'timeline' | 'grid'

/** 错落进入的延迟上限：第 7 项之后不再累加，否则末尾要等太久 */
const STAGGER_MS = 16
const STAGGER_CAP = 6

const stagger = (i: number) => ({
  animationDelay: `${Math.min(i, STAGGER_CAP) * STAGGER_MS}ms`,
})

function TimelineRow({ r, index }: { r: WatchRecord; index: number }) {
  const [, month, day] = r.watchedOn.split('-')

  // 只给影厅格式上色块——它是这个 App 的招牌字段。
  // 版本类型和重看次数降级成普通文字，避免一行里堆三个同样的灰药丸。
  const extras = [
    `${Number(month)}月${Number(day)}日`,
    r.versionType !== '原版字幕' ? r.versionType : null,
    r.rewatchCount > 0 ? `重看 ${r.rewatchCount}` : null,
  ].filter(Boolean)

  return (
    <Link
      to={`/record/${r.id}`}
      style={stagger(index)}
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

function GridCard({ r, index }: { r: WatchRecord; index: number }) {
  return (
    <Link
      to={`/record/${r.id}`}
      style={stagger(index)}
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

  const toggle = (
    <div className="flex rounded-lg bg-surface-2 p-0.5">
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
          onClick={() => setView(key)}
          className={`rounded-md px-2 py-1.5 transition-colors duration-150 ${
            view === key ? 'bg-canvas text-ink' : 'text-muted'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )

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
          {records.length > 0 && toggle}
        </div>
      </header>

      {records.length === 0 ? (
        <EmptyState />
      ) : (
        /* key={view} 让切换视图时子树重新挂载，错落动画才会重放 */
        <div key={view} className="px-5 pt-1">
          {view === 'timeline' ? (
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
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-6 pt-3">
              {records.map((r) => (
                <GridCard key={r.id} r={r} index={order.get(r.id) ?? 0} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
