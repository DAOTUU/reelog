import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 每小时

/**
 * 新版本提示。
 *
 * 为什么必须有：vite.config.ts 里用的是 registerType: 'prompt'，意思是
 * Service Worker 发现新版本后**不会自己激活**，要等页面主动调 skipWaiting。
 * 如果没有这个提示界面，新版本会一直躺在等待队列里，用户永远看到旧版本。
 *
 * 这在 iOS 上尤其致命——主屏幕 App 没有「强制刷新」这个操作，
 * 用户没有任何办法手动拿到新版本。
 *
 * 之所以不改成 autoUpdate：那样会在用户正在录入时突然刷新页面，
 * 把填了一半的表单冲掉。所以是"提示 + 用户点确认"。
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // 定期主动查更新。iOS 的 PWA 可能几周不被完全关闭，
      // 只靠导航时检查会一直错过新版本。
      if (!registration) return
      setInterval(() => {
        void registration.update()
      }, CHECK_INTERVAL_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md sm:bottom-8">
      <div className="anim-fade-up rounded-xl border border-line bg-canvas p-4 shadow-lg">
        <p className="text-body font-medium text-ink">有新版本</p>
        <p className="text-meta mt-1 leading-relaxed text-muted">
          更新会重新加载页面。你的观影记录存在本地，不受影响。
        </p>
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="text-meta flex-1 rounded-lg bg-ink px-3 py-2.5 font-semibold text-canvas transition-opacity active:opacity-70"
          >
            立即更新
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="text-meta rounded-lg bg-surface-2 px-3 py-2.5 font-medium text-ink-2 transition-opacity active:opacity-55"
          >
            稍后
          </button>
        </div>
      </div>
    </div>
  )
}
