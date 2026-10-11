import { useEffect, useMemo, useState } from 'react'
import {
  generateShareImage,
  shareImageFilename,
  type ShareImageResult,
} from '../share/generate'
import type { ShareView } from '../share/layout'
import { downloadBlob } from '../transfer/export'

/**
 * 分享长图的预览弹窗。
 *
 * 为什么非要「先生成、再出预览、预览上再点分享」，而不是点一下直接弹系统分享面板：
 *
 * **iOS 要求 navigator.share 必须在用户手势的调用栈里。** 生成一张长图要几秒
 * （要逐张解码海报），等图出来的时候，最初那次点击的手势早就过期了，直接调
 * share 会被系统拒绝。所以真正的分享按钮必须落在预览界面上——那一下点击
 * 是一次全新的、合法的手势。
 *
 * 顺带也是更好的交互：分享之前能先看见自己发出的是什么。
 */

type Status = 'working' | 'ready' | 'error'

export default function ShareImageDialog({
  view,
  onClose,
}: {
  view: ShareView
  onClose: () => void
}) {
  const [status, setStatus] = useState<Status>('working')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ShareImageResult>()
  const [error, setError] = useState<string>()
  const [url, setUrl] = useState<string>()
  /** 点「重试」时自增，用来重新触发下面的 effect */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // alive 是为了 StrictMode：开发环境下 effect 会跑两次，
    // 第一次的 cleanup 会先把 alive 置 false，它的结果就被丢弃，用第二次的。
    let alive = true
    setStatus('working')
    setError(undefined)
    setProgress({ done: 0, total: 0 })

    generateShareImage(view, {
      onProgress: (done, total) => {
        if (alive) setProgress({ done, total })
      },
    })
      .then((r) => {
        if (!alive) return
        setResult(r)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : '生成失败')
        setStatus('error')
      })

    return () => {
      alive = false
    }
  }, [view, attempt])

  useEffect(() => {
    if (!result) return
    const objectUrl = URL.createObjectURL(result.blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [result])

  const file = useMemo(
    () =>
      result
        ? new File([result.blob], shareImageFilename(), { type: 'image/png' })
        : undefined,
    [result],
  )

  /**
   * 不支持分享文件的环境（多数桌面浏览器）就干脆不显示「分享」按钮。
   * 留一个点了没反应的按钮比没有按钮更让人困惑。
   */
  const canShare = useMemo(() => {
    if (!file || typeof navigator.canShare !== 'function') return false
    try {
      return navigator.canShare({ files: [file] })
    } catch {
      return false
    }
  }, [file])

  async function handleShare() {
    if (!file) return
    try {
      await navigator.share({ files: [file] })
    } catch {
      // 用户在系统面板里按了取消，不是错误，不需要任何提示
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="safe-bottom anim-fade-up flex max-h-[88vh] w-full max-w-md flex-col rounded-t-2xl bg-canvas p-5 sm:rounded-2xl">
        <h2 className="text-title shrink-0 text-ink">分享长图</h2>

        {status === 'working' && (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-body text-ink-2">
              {progress.total > 0
                ? `正在处理海报 ${progress.done}/${progress.total}`
                : '正在生成…'}
            </p>
            <p className="text-meta text-muted">图片较大，请稍等几秒</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-body text-ink-2">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="text-body rounded-xl bg-surface-2 px-5 py-2.5 font-medium text-ink-2"
            >
              重试
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {result?.truncated && (
              <p className="text-meta mt-2.5 shrink-0 border-l-2 border-accent bg-surface-2 py-2.5 pr-3 pl-2.5 leading-relaxed text-ink-2">
                一张图放不下全部 {result.total} 条，
                这张含最近 <b className="font-semibold text-ink">{result.included}</b> 条。
                想全放进去可以用网格视图，它排得更密。
              </p>
            )}

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line bg-surface-2 p-2">
              {url && (
                <img src={url} alt="分享长图预览" className="w-full rounded-lg" />
              )}
            </div>

            <div className="mt-4 flex shrink-0 gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="text-body flex-1 rounded-xl bg-surface-2 px-3 py-3 font-medium text-ink-2 transition-opacity active:opacity-55"
              >
                关闭
              </button>
              <button
                type="button"
                disabled={!result}
                onClick={() => result && downloadBlob(result.blob, shareImageFilename())}
                className="text-body flex-1 rounded-xl border border-line px-3 py-3 font-medium text-ink transition-opacity active:opacity-55 disabled:opacity-50"
              >
                保存图片
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="text-body flex-1 rounded-xl bg-ink px-3 py-3 font-semibold text-canvas transition-opacity active:opacity-70"
                >
                  分享
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
