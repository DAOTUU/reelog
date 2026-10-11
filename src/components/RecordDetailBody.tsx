import { useState } from 'react'
import type { WatchRecord } from '../db/types'
import { softDeleteRecord } from '../db/records'
import Poster from './Poster'
import RatingStars from './RatingStars'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-4 py-3">
      <span className="text-meta shrink-0 text-muted">{label}</span>
      <span className="text-body text-right text-ink">{value}</span>
    </div>
  )
}

/**
 * 记录详情的内容主体。
 *
 * 从 RecordDetailPage 里抽出来，是因为它现在有两个宿主：
 * 移动端是整页（外面套一个带返回按钮的页头），桌面端是两栏布局的右栏
 * （外面套一个带编辑按钮的面板头）。两者共用同一份内容。
 */
export default function RecordDetailBody({
  record,
  onDeleted,
}: {
  record: WatchRecord
  onDeleted?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [, month, day] = record.watchedOn.split('-')

  async function handleDelete() {
    await softDeleteRecord(record.id)
    onDeleted?.()
  }

  return (
    <div>
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
  )
}
