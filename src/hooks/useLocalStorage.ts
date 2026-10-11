import { useCallback, useState } from 'react'

/** 读写 localStorage 的小封装。只用于 UI 偏好，不用于观影数据。 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // 隐私模式 / 配额满：忽略，UI 本次会话仍然正确
      }
    },
    [key],
  )

  return [value, set] as const
}
