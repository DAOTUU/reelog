import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Poster from '../components/Poster'
import RatingStars from '../components/RatingStars'
import { ChevronLeftIcon } from '../components/icons'
import { db } from '../db/db'
import { softDeleteRecord } from '../db/records'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-4 py-3">
      <span className="text-meta shrink-0 text-muted">{label}</span>
      <span className="text-body text-right text-ink">{value}</span>
    </div>
  )
}

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)

  const record = useLiveQuery(async () => {
    if (!id) return undefined
    return await db.records.get(id)
  }, [id])

  // undefined = 还在读；null 之类表示不存在
  if (record === undefined) return null

  if (!record || record.deletedAt) {
    return (
      <div className="safe-top flex min-h-full flex-col items-center justify-center gap-4 bg-canvas px-6">
        <p className="text-body text-muted">这条记录不存在，或已被删除。</p>
        <Link to="/" className="text-body text-accent">
          回到日记
        </Link>
      </div>
    )
  }

  const [, month, day] = record.watchedOn.split('-')

  async function handleDelete() {
    if (!id) return
    await softDeleteRecord(id)
    navigate('/', { replace: true })
  }

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
          <div className="flex-1" />
          <Link
            to={`/edit/${record.id}`}
            className="text-meta rounded-lg px-3 py-1.5 font-semibold text-ink transition-opacity active:opacity-55"
          >
            编辑
          </Link>
        </div>
      </header>

      <div className="px-5 pt-5 pb-10">
        <div className="flex gap-4">
          <Poster
            posterKey={record.posterKey}
            className="h-[168px] w-[112px] shrink-0 rounded-lg"
          />
          <div className="flex min-w-0 flex-1 flex-col py-1">
            <h1 className="text-display text-ink">{record.title}</h1>
            {record.originalTitle && (
              <p className="text-meta mt-1.5 text-muted">{record.originalTitle}</p>
            )}
            <p className="text-meta mt-1 tabular-nums text-muted">
              {record.year !== null ? `${record.year} 年` : ''}
            </p>

            {record.rating !== null && (
              <div className="mt-auto flex items-center gap-2 pt-4">
                <RatingStars value={record.rating} size={16} />
                <span className="text-meta tabular-nums text-muted">
                  {record.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        <section className="mt-7">
          <h2 className="text-meta mb-2 px-1 font-medium text-muted">观影信息</h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            <MetaRow
              label="日期"
              value={`${record.watchedOn.slice(0, 4)} 年 ${Number(month)} 月 ${Number(day)} 日`}
            />
            <MetaRow label="影院" value={record.cinema || '未填'} />
            <MetaRow label="影厅" value={record.hallFormat} />
            <MetaRow label="版本" value={record.versionType} />
            <MetaRow
              label="重看"
              value={record.rewatchCount > 0 ? `${record.rewatchCount} 次` : '首看'}
            />
          </div>
        </section>

        {record.review && (
          <section className="mt-7">
            <h2 className="text-meta mb-2 px-1 font-medium text-muted">短评</h2>
            <p className="text-body rounded-xl border border-line bg-surface px-4 py-3.5 leading-relaxed whitespace-pre-wrap text-ink">
              {record.review}
            </p>
          </section>
        )}

        <section className="mt-10">
          {confirming ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className="text-body flex-1 rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition-opacity active:opacity-70"
              >
                确认删除
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-body rounded-xl bg-surface-2 px-4 py-3 font-medium text-ink-2"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-body w-full rounded-xl border border-line px-4 py-3 font-medium text-red-500 transition-opacity active:opacity-55"
            >
              删除这条记录
            </button>
          )}
          <p className="text-meta mt-3 px-1 leading-relaxed text-muted">
            删除是软删除——记录会被标记为已删除而不是抹掉，这样当你在另一台设备上导入旧备份时，它不会被「复活」。
          </p>
        </section>
      </div>
    </div>
  )
}
