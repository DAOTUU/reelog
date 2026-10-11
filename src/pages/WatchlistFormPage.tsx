import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TmdbSearchPanel, { type SearchHit } from '../components/TmdbSearchPanel'
import { ChevronLeftIcon } from '../components/icons'
import { createWatchlistItem, updateWatchlistItem } from '../db/watchlist'
import { putPoster } from '../db/posters'
import { fetchAndIngestPoster } from '../media/poster'

const inputCls =
  'text-base w-full bg-transparent text-ink placeholder:text-muted focus:outline-none'

export default function WatchlistFormPage() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [note, setNote] = useState('')
  const [tmdbId, setTmdbId] = useState<number | null>(null)
  const [pending, setPending] = useState<{ blob: Blob; mimeType: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [fetching, setFetching] = useState(false)
  const [note2, setNote2] = useState<string>()
  const [saving, setSaving] = useState(false)

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
    setYear(hit.year === null ? '' : String(hit.year))
    setTmdbId(hit.tmdbId)
    setNote2(undefined)

    if (!hit.posterPath) {
      setPending(null)
      return
    }
    setFetching(true)
    try {
      const ingested = await fetchAndIngestPoster(hit.posterPath)
      setPending({ blob: ingested.blob, mimeType: ingested.mimeType })
    } catch (e) {
      setPending(null)
      setNote2(e instanceof Error ? e.message : '海报抓取失败')
    } finally {
      setFetching(false)
    }
  }

  async function handleSave() {
    if (!valid || saving) return
    setSaving(true)
    try {
      const id = await createWatchlistItem({
        tmdbId,
        title: title.trim(),
        year: year ? Number(year) : null,
        note: note.trim() || undefined,
      })

      if (pending) {
        // 海报与条目一对一，直接用条目 id 当主键
        await putPoster({
          key: id,
          blob: pending.blob,
          mimeType: pending.mimeType,
          width: 0,
          height: 0,
        })
        await updateWatchlistItem(id, { posterKey: id })
      }

      navigate('/watchlist', { replace: true })
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-title flex-1 text-ink">加入想看</h1>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={handleSave}
            className={`text-meta rounded-lg px-3.5 py-1.5 font-semibold transition-opacity duration-150 ${
              valid
                ? 'bg-ink text-canvas active:opacity-70'
                : 'bg-surface-2 text-muted'
            }`}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </header>

      <div className="px-5 pt-5">
        <section className="mb-6">
          <h2 className="text-meta mb-2 px-1 font-medium text-muted">
            从 TMDB 搜索
          </h2>
          <div className="rounded-xl border border-line bg-surface p-3">
            <TmdbSearchPanel onPick={applyHit} />
          </div>
        </section>

        <p className="text-meta mb-6 -mt-3 px-1 text-muted">
          搜不到也可以直接往下手动填，两者不冲突。
        </p>

        <section className="mb-6">
          <h2 className="text-meta mb-2 px-1 font-medium text-muted">影片</h2>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-4 px-4 py-3.5">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="h-[88px] w-[59px] shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="text-meta flex h-[88px] w-[59px] shrink-0 items-center justify-center rounded-md border border-dashed border-line text-muted">
                  {fetching ? '抓取中' : '海报'}
                </div>
              )}
              <p className="text-meta leading-relaxed text-muted">
                {note2 ? (
                  <span className="text-red-500">{note2}</span>
                ) : fetching ? (
                  '正在下载海报…'
                ) : previewUrl ? (
                  '海报会在保存时存进本地。'
                ) : (
                  '选填。没有海报也能加进想看清单。'
                )}
              </p>
            </div>

            <label className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-body w-[64px] shrink-0 text-ink">片名</span>
              <div className="min-w-0 flex-1">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="必填"
                  className={inputCls}
                />
              </div>
            </label>
            <label className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-body w-[64px] shrink-0 text-ink">年份</span>
              <div className="min-w-0 flex-1">
                <input
                  value={year}
                  onChange={(e) =>
                    setYear(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  inputMode="numeric"
                  placeholder="选填"
                  className={`${inputCls} tabular-nums`}
                />
              </div>
            </label>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-meta mb-2 px-1 font-medium text-muted">备注</h2>
          <div className="rounded-xl border border-line bg-surface">
            <div className="px-4 py-3.5">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="为什么想看？谁推荐的？（选填）"
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
