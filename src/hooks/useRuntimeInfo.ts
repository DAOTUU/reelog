import { useEffect, useState } from 'react'
import { isStandalone } from '../lib/storage'

export type RuntimeInfo = {
  /** 是否以独立 Web App 方式运行（决定能否豁免 ITP 的 7 天清理） */
  standalone: boolean
  origin: string
  /** 是否安全上下文。false 时 Service Worker 无法注册。 */
  secure: boolean
  sw: string
}

/**
 * 把「当前跑在什么环境里」摊开显示。
 *
 * 这不是给用户看的装饰——装到 iPhone 后要判断的是两件独立的事：
 * ① 它有没有被当成 Web App（standalone），② Service Worker 有没有注册。
 * 两者都可能单独失败，靠猜会浪费好几天。
 */
export function useRuntimeInfo(): RuntimeInfo {
  const [sw, setSw] = useState('检测中…')

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSw('浏览器不支持')
      return
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) setSw('未注册')
        else if (reg.active) setSw('已启用')
        else setSw('已注册，未激活')
      })
      .catch(() => setSw('查询失败'))
  }, [])

  return {
    standalone: isStandalone(),
    origin: typeof location !== 'undefined' ? location.origin : '—',
    secure: typeof window !== 'undefined' ? window.isSecureContext : false,
    sw,
  }
}
