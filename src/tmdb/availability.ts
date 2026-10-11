import { useCallback, useEffect, useState } from 'react'
import { probe, TmdbError } from './client'
import { hasKey, loadTmdbConfig } from './settings'

export type TmdbStatus =
  | 'unknown'
  | 'checking'
  | 'ok'
  | 'no-key'
  | 'bad-key'
  | 'offline'
  | 'unreachable'

export type TmdbAvailability = {
  status: TmdbStatus
  /** 失败原因的自然语言说明，成功时为 undefined */
  detail?: string
  recheck: () => void
}

/**
 * TMDB 可达性探测。
 *
 * 探的是**用户配置的 apiBase**，不是硬编码的 api.themoviedb.org——
 * 后者在国内必然失败，拿它探测等于永远显示"不可用"。
 */
export function useTmdbStatus(): TmdbAvailability {
  const [status, setStatus] = useState<TmdbStatus>('unknown')
  const [detail, setDetail] = useState<string>()

  const check = useCallback(async () => {
    const cfg = loadTmdbConfig()

    if (!hasKey(cfg)) {
      setStatus('no-key')
      setDetail(undefined)
      return
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('offline')
      setDetail('设备当前离线')
      return
    }

    setStatus('checking')
    try {
      await probe(cfg)
      setStatus('ok')
      setDetail(undefined)
    } catch (e) {
      const err = e instanceof TmdbError ? e : null
      setStatus(err?.kind === 'auth' ? 'bad-key' : 'unreachable')
      setDetail(err?.message ?? '未知错误')
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  // 网络状态变化时自动重探，不用用户手动点
  useEffect(() => {
    const on = () => void check()
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [check])

  return { status, detail, recheck: check }
}

/** 给 UI 用的文案。原则：永远不转圈、不甩报错，直接说清楚现在能做什么。 */
export function statusMessage(a: TmdbAvailability): string | null {
  switch (a.status) {
    case 'ok':
      return null
    case 'no-key':
      return '未配置 TMDB API Key。可以直接手动填写下方表单，或前往设置填入 Key。'
    case 'bad-key':
      return 'API Key 无效或已失效。请到设置页检查。手动填写不受影响。'
    case 'offline':
      return '当前离线，手动录入不受影响。'
    case 'unreachable':
      return '当前搜不了新片（需要挂代理）。手动填写下方表单不受影响。'
    case 'checking':
      return '正在检查 TMDB 连接…'
    default:
      return null
  }
}
