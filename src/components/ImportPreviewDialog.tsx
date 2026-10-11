import { useState } from 'react'
import type { ImportPreview } from '../transfer/import'

function Stat({
  label,
  added,
  updated,
  unchanged,
}: {
  label: string
  added: number
  updated: number
  unchanged: number
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-body text-ink">{label}</span>
      <span className="text-meta tabular-nums text-muted">
        新增 <b className="font-semibold text-ink">{added}</b>
        {updated > 0 && (
          <>
            {' · 覆盖 '}
            <b className="font-semibold text-ink">{updated}</b>
          </>
        )}
        {unchanged > 0 && ` · 不变 ${unchanged}`}
      </span>
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: 'info' | 'warn'
  children: React.ReactNode
}) {
  const color = tone === 'warn' ? 'border-accent' : 'border-line'
  return (
    <div className={`text-meta border-l-2 ${color} bg-surface-2 py-2.5 pr-3 pl-2.5 text-ink-2`}>
      {children}
    </div>
  )
}

export default function ImportPreviewDialog({
  preview,
  filename,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: ImportPreview
  filename: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [showDupes, setShowDupes] = useState(false)
  const { recordStats, newPosters, missingPosters, duplicates } = preview

  const nothingToDo = recordStats.added + recordStats.updated === 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="safe-bottom anim-fade-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-canvas p-5 sm:rounded-2xl">
        <h2 className="text-title text-ink">导入预览</h2>
        <p className="text-meta mt-1 truncate text-muted">{filename}</p>

        <div className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface px-4">
          <Stat
            label="观影记录"
            added={recordStats.added}
            updated={recordStats.updated}
            unchanged={recordStats.unchanged}
          />
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="text-body text-ink">海报</span>
            <span className="text-meta tabular-nums text-muted">
              新增 <b className="font-semibold text-ink">{newPosters}</b> 张
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {recordStats.overwritten > 0 && (
            <Notice tone="info">
              有 {recordStats.overwritten} 条本地的内容会被备份里的版本覆盖。
              覆盖规则是「谁修改得晚听谁的」。
            </Notice>
          )}

          {missingPosters > 0 && (
            <Notice tone="warn">
              有 {missingPosters} 张海报在 zip 里找不到对应文件（备份包可能不完整）。
              记录本身照常导入，这些图会显示为占位。
            </Notice>
          )}

          {duplicates.length > 0 && (
            <Notice tone="warn">
              <button
                type="button"
                onClick={() => setShowDupes((v) => !v)}
                className="text-left"
              >
                发现 {duplicates.length} 组疑似重复（同一部片、同一天，但分属两条记录）。
                <span className="text-accent"> {showDupes ? '收起' : '展开'}</span>
              </button>
              {showDupes && (
                <ul className="mt-2 space-y-1">
                  {duplicates.map((g) => (
                    <li key={g[0].id} className="text-muted">
                      {g[0].title} · {g[0].watchedOn}
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-2 block text-muted">
                不会自动合并——两个不同影院看同一部片是正常情况。
                导入后可以自己删掉多余的那条。
              </span>
            </Notice>
          )}

          {nothingToDo && (
            <Notice tone="info">
              这个备份里的内容本地都已经有了，导入不会有任何变化。
            </Notice>
          )}

          <Notice tone="info">
            导入前会自动把当前数据另存一份到「历史备份」，出问题可以回滚。
          </Notice>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-body flex-1 rounded-xl bg-surface-2 px-4 py-3 font-medium text-ink-2 transition-opacity active:opacity-55"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="text-body flex-1 rounded-xl bg-ink px-4 py-3 font-semibold text-canvas transition-opacity active:opacity-70 disabled:opacity-50"
          >
            {busy ? '导入中…' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
