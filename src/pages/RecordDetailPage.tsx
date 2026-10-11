import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import RecordDetailBody from '../components/RecordDetailBody'
import { ChevronLeftIcon } from '../components/icons'
import { db } from '../db/db'

/**
 * 移动端的整页详情。
 *
 * 桌面上不走这里——那里是两栏布局，详情渲染在右栏，
 * 共用 RecordDetailBody。
 */
export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const record = useLiveQuery(async () => {
    if (!id) return undefined
    return await db.records.get(id)
  }, [id])

  // undefined = 还在读
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
        <RecordDetailBody
          record={record}
          onDeleted={() => navigate('/', { replace: true })}
        />
      </div>
    </div>
  )
}
