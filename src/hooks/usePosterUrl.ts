import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

/**
 * 把 IndexedDB 里存的海报 Blob 换成一个可用的 object URL。
 *
 * 撤销必须放在 effect 的 cleanup 里，不能在 img 的 onload 里提前撤销——
 * 那样用户长按保存图片会拿到一个已经失效的 URL。
 *
 * 单独放一个文件（而不是跟 Poster 组件同文件）是为了让 Vite 的
 * Fast Refresh 正常工作：一个模块同时导出组件和 hook 会让它退化
 * 成整页刷新。
 */
export function usePosterUrl(posterKey?: string): string | undefined {
  const poster = useLiveQuery(async () => {
    if (!posterKey) return undefined
    return await db.posters.get(posterKey)
  }, [posterKey])

  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!poster?.blob) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(poster.blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [poster])

  return url
}
