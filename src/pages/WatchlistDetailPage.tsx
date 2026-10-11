import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Poster from '../components/Poster'
import { ChevronLeftIcon } from '../components/icons'
import { db } from '../db/db'
import { createRecord } from '../db/records'
import { softDeleteWatchlistItem } from '../db/watchlist'

function todayISO() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function WatchlistDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const item = useLiveQuery(async () => {
    if (!id) return undefined
    return await db.watchlist.get(id)
  }, [id])

  if (item === undefined) return null

  if (!item || item.deletedAt) {
    return (
      <div className="safe-top flex min-h-full flex-col items-center justify-center gap-4 bg-canvas px-6">
        <p className="text-body text-muted">这条想看不存在，或已被删除。</p>
        <Link to="/watchlist" className="text-body text-accent">
          回到想看
        </Link>
      </div>
    )
  }

  /**
   * 标记为已看。
   *
   * 不是简单改状态，而是**建一条观影记录、再把想看那条软删除**，
   * 然后跳到编辑页让用户补影院和评分——因为这些信息只有看完才知道。
   * 海报直接沿用想看那条的主键，不用重新下载。
   */
  async function markAsWatched() {
    if (!item || busy) return
    setBusy(true)
    try {
      const recordId = await createRecord({
        tmdbId: item.tmdbId,
        title: item.title,
        year: item.year,
        posterKey: item.posterKey,
        watchedOn: todayISO(),
        cinema: '',
        hallFormat: '普通',
        versionType: '原版字幕',
        rating: null,
        review: '',
        rewatchCount: 0,
      })
      await softDeleteWatchlistItem(item.id)
      navigate(`/edit/${recordId}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item || busy) return
    setBusy(true)
    await softDeleteWatchlistItem(item.id)
    navigate('/watchlist', { replace: true })
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
        </div>
      </header>

      <div className="px-5 pt-5 pb-10">
        <div className="flex gap-4">
          <Poster
            posterKey={item.posterKey}
            className="h-[168px] w-[112px] shrink-0 rounded-lg"
          />
          <div className="flex min-w-0 flex-1 flex-col py-1">
            <h1 className="text-display text-ink">{item.title}</h1>
            {item.year !== null && (
              <p className="text-meta mt-1.5 tabular-nums text-muted">
                {item.year} 年
              </p>
            )}
          </div>
        </div>

        {item.note && (
          <section className="mt-7">
            <h2 className="text-meta mb-2 px-1 font-medium text-muted">备注</h2>
            <p className="text-body rounded-xl border border-line bg-surface px-4 py-3.5 leading-relaxed whitespace-pre-wrap text-ink">
              {item.note}
            </p>
          </section>
        )}

        <section className="mt-8 space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={markAsWatched}
            className="text-body w-full rounded-xl bg-ink px-4 py-3.5 font-semibold text-canvas transition-opacity active:opacity-70 disabled:opacity-50"
          >
            看过，记一条观影记录
          </button>
          <p className="text-meta px-1 leading-relaxed text-muted">
            会建一条记录（日期默认今天），然后跳到编辑页让你补
            <strong className="text-ink-2">影院、影厅和评分</strong>
            ——这些看完才知道。
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="text-body w-full rounded-xl border border-line px-4 py-3 font-medium text-red-500 transition-opacity active:opacity-55 disabled:opacity-50"
          >
            从想看里删掉
          </button>
        </section>
      </div>
    </div>
  )
}
