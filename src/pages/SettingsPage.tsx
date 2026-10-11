import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ImportPreviewDialog from '../components/ImportPreviewDialog'
import TmdbSettings from '../components/TmdbSettings'
import { BACKUP_REMINDER_DAYS } from '../lib/constants'
import type { Backup } from '../db/types'
import { META_KEYS, getMeta } from '../db/meta'
import { useRuntimeInfo } from '../hooks/useRuntimeInfo'
import { useStorageInfo } from '../hooks/useStorageInfo'
import { clearAllData, seedSampleData } from '../lib/seed'
import {
  formatBytes,
  isStandalone,
  persistSupported,
  requestPersist,
} from '../lib/storage'
import {
  backupBytes,
  deleteBackup,
  listBackups,
  saveBackup,
} from '../transfer/backup'
import { backupFilename, buildBackup, downloadBlob, exportBackup } from '../transfer/export'
import {
  applyImport,
  parseBackupZip,
  previewImport,
  type ImportPreview,
} from '../transfer/import'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-meta mb-2 px-1 font-medium text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  value,
  onClick,
  danger,
  disabled,
}: {
  label: string
  value?: ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  const tone = danger ? 'text-red-500' : 'text-ink'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-opacity active:opacity-55 disabled:opacity-40"
      >
        <span className={`text-body ${tone}`}>{label}</span>
        <span className="text-meta shrink-0 text-muted">{value ?? '›'}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span className={`text-body ${tone}`}>{label}</span>
      {value !== undefined && (
        <span className="text-meta shrink-0 text-muted">{value}</span>
      )}
    </div>
  )
}

function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn'
  children: ReactNode
}) {
  return (
    <p
      className={`text-meta border-l-2 ${
        tone === 'warn' ? 'border-accent' : 'border-line'
      } bg-surface-2 px-2.5 py-2.5 leading-relaxed text-ink-2`}
    >
      {children}
    </p>
  )
}

function relativeDays(ts: number | null): string {
  if (ts === null) return '从未导出'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { info, refresh } = useStorageInfo()
  const runtime = useRuntimeInfo()

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>()
  const [error, setError] = useState<string>()
  const [persistMsg, setPersistMsg] = useState<string>()

  const [backups, setBackups] = useState<Backup[]>([])
  const [backupSize, setBackupSize] = useState(0)
  const [lastExportAt, setLastExportAt] = useState<number | null>(null)

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [previewName, setPreviewName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const refreshAll = useCallback(async () => {
    await refresh()
    setBackups(await listBackups())
    setBackupSize(await backupBytes())
    setLastExportAt(await getMeta<number | null>(META_KEYS.lastExportAt, null))
  }, [refresh])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // ---------- 导出 ----------

  async function handleExport() {
    setBusy(true)
    setError(undefined)
    try {
      const built = await exportBackup()
      downloadBlob(built.blob, backupFilename())
      setMsg(
        `已导出 ${built.file.records.length} 条记录、${built.file.posters.length} 张海报。`,
      )
      await refreshAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // ---------- 导入 ----------

  async function beginImport(blob: Blob, filename: string) {
    setBusy(true)
    setError(undefined)
    setMsg(undefined)
    try {
      const parsed = await parseBackupZip(blob)
      const p = await previewImport(parsed)
      setPreview(p)
      setPreviewName(filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    try {
      // ⚠️ 必须在任何写操作之前。用户点错文件时这是唯一退路。
      const current = await buildBackup()
      await saveBackup({
        kind: 'pre-import',
        label: `导入前 · ${new Date().toLocaleString('zh-CN')}`,
        blob: current.blob,
        recordCount: current.file.records.length,
        posterCount: current.file.posters.length,
      })

      await applyImport(preview)
      setPreview(null)
      await refreshAll()
      setMsg('导入完成。')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(b: Backup) {
    await beginImport(b.blob, `${b.label}（库内快照）`)
  }

  async function handlePersist() {
    setBusy(true)
    const result = await requestPersist()
    setPersistMsg(
      result === null
        ? '这个浏览器不支持申请持久模式'
        : result
          ? '已授予持久模式'
          : '被拒绝。真正的备份手段仍然是定期导出。',
    )
    await refreshAll()
    setBusy(false)
  }

  const installed = isStandalone()
  const overdue =
    lastExportAt === null ||
    Date.now() - lastExportAt > BACKUP_REMINDER_DAYS * 86_400_000

  return (
    <>
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="px-5 pt-4 pb-3.5">
          <h1 className="text-display text-ink">设置</h1>
        </div>
      </header>

      <div className="px-5 pt-5">
        {!installed && (
          <div className="text-meta border-l-2 border-accent bg-surface-2 mb-7 py-2.5 pr-3 pl-2.5 leading-relaxed text-ink-2">
            <strong className="text-ink">你正在浏览器标签页里使用。</strong>
            请先「添加到主屏幕」，再从主屏幕图标打开。两个原因：
            <br />① iOS 只对已安装的 Web App 豁免 7 天后的存储清理；
            <br />② 标签页里和装成 App 后是<strong className="text-ink">两个互不相通的数据空间</strong>，现在录的东西装完看不见。
          </div>
        )}

        {/* ---------- 备份：最重要的一块，放在最前 ---------- */}
        <Section title="备份">
          <Row
            label="导出备份"
            value={busy ? '…' : relativeDays(lastExportAt)}
            onClick={busy ? undefined : handleExport}
          />
          <Row
            label="从文件导入"
            onClick={busy ? undefined : () => fileInput.current?.click()}
          />
          <Row label="历史备份" value={`${backups.length} 份 · ${formatBytes(backupSize)}`} />
        </Section>

        {overdue && (
          <div className="mb-7 -mt-4">
            <Note tone="warn">
              已经 {lastExportAt === null ? '从未导出过' : `${relativeDays(lastExportAt)}没导出`}。
              本地是唯一副本——设备丢了、或者手动清了浏览器数据，记录就没了。
              建议现在导出一份存到网盘或电脑上。
            </Note>
          </div>
        )}

        {msg && <p className="text-meta mb-4 -mt-2 px-1 text-ink-2">{msg}</p>}
        {error && (
          <p className="text-meta mb-4 -mt-2 px-1 leading-relaxed text-red-500">
            {error}
          </p>
        )}

        {backups.length > 0 && (
          <Section title="库内快照">
            {backups.map((b) => (
              <div key={b.id} className="px-4 py-3.5">
                <p className="text-body text-ink">{b.label}</p>
                <p className="text-meta mt-0.5 text-muted">
                  {b.recordCount} 条 · {b.posterCount} 张 · {formatBytes(b.blob.size)}
                </p>
                <div className="mt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() => downloadBlob(b.blob, backupFilename(new Date(b.createdAt)))}
                    className="text-meta text-accent"
                  >
                    下载
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRestore(b)}
                    className="text-meta text-accent disabled:opacity-40"
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteBackup(b.id)
                      await refreshAll()
                    }}
                    className="text-meta text-muted"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </Section>
        )}

        <Section title="运行环境">
          <Row
            label="运行方式"
            value={runtime.standalone ? '独立 App' : '浏览器标签页'}
          />
          <Row label="安全上下文" value={runtime.secure ? '是' : '否（SW 无法注册）'} />
          <Row label="Service Worker" value={runtime.sw} />
          <Row label="地址" value={runtime.origin} />
        </Section>

        <Section title="存储">
          <Row label="观影记录" value={`${info.records} 条`} />
          <Row label="海报" value={`${info.posters} 张`} />
          <Row label="已用空间" value={formatBytes(info.usage)} />
          <Row label="配额上限" value={formatBytes(info.quota)} />
          <Row
            label="持久模式"
            value={
              info.persisted === null
                ? '不支持查询'
                : info.persisted
                  ? '已开启'
                  : '未开启'
            }
          />
          {persistSupported() && info.persisted !== true && (
            <Row
              label="申请持久模式"
              value={busy ? '…' : '›'}
              onClick={busy ? undefined : handlePersist}
            />
          )}
        </Section>
        {persistMsg && (
          <p className="text-meta mb-7 -mt-4 px-1 text-muted">{persistMsg}</p>
        )}

        <section className="mb-7">
          <h2 className="text-meta mb-2 px-1 font-medium text-muted">
            TMDB 影片数据
          </h2>
          <TmdbSettings />
        </section>

        <Section title="开发工具">
          <Row
            label="载入示例数据"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const n = await seedSampleData()
              await refreshAll()
              setBusy(false)
              setMsg(`已载入 ${n} 条示例数据。`)
            }}
          />
          <Row
            label="清空全部数据"
            danger
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('确定清空所有观影记录和海报？此操作不可撤销。'))
                return
              setBusy(true)
              await clearAllData()
              await refreshAll()
              setBusy(false)
              setMsg('已清空。')
            }}
          />
        </Section>
        <p className="text-meta mb-7 -mt-4 px-1 leading-relaxed text-muted">
          「开发工具」这一组是临时入口，正式发布前会移除。
        </p>

        <Section title="关于">
          <Row label="版本" value="0.1.0" />
          <Row
            label="数据来源与署名"
            onClick={() => navigate('/credits')}
          />
          <Row
            label="强制更新到最新版"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              // 三步缺一不可。此前只做了第一步，所以坏状态会原样复活：
              // 注销 SW、重载，重载后 useRegisterSW 立刻又注册回同一个 SW，
              // 它的 Cache Storage 里还是那份坏缓存 → 下次打开照样裸奔。
              //
              // 全程只碰「缓存外壳」，**绝不碰 IndexedDB**——
              // 观影记录、海报、设置都在 IndexedDB 里，动不得。
              try {
                // 1. 注销所有 Service Worker
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations()
                  await Promise.all(regs.map((r) => r.unregister()))
                }

                // 2. 清空 Cache Storage。这是上次漏掉的一步，也是根因所在：
                //    SW 的预缓存里可能留着与当前 HTML 不同代次的 CSS/JS。
                if (typeof caches !== 'undefined') {
                  const keys = await caches.keys()
                  await Promise.all(keys.map((k) => caches.delete(k)))
                }
              } catch {
                // 清理失败也要继续往下走重载，不能让按钮卡死在 busy。
              }

              // 3. 带时间戳重载，顺带绕开 HTTP 缓存里的旧 index.html。
              //    用完即弃的查询参数不影响路由匹配，SW 的 scope 也不受影响。
              const url = new URL(location.href)
              url.searchParams.set('_r', String(Date.now()))
              location.replace(url.toString())
            }}
          />
        </Section>
        <p className="text-meta mb-7 -mt-4 px-1 leading-relaxed text-muted">
          「强制更新」只清应用的缓存外壳，
          <strong className="text-ink-2">不会动你的观影记录和海报</strong>
          ——那些在另一套存储里。
        </p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = '' // 允许连续选同一个文件
          if (f) void beginImport(f, f.name)
        }}
      />

      {preview && (
        <ImportPreviewDialog
          preview={preview}
          filename={previewName}
          busy={busy}
          onCancel={() => setPreview(null)}
          onConfirm={confirmImport}
        />
      )}
    </>
  )
}
