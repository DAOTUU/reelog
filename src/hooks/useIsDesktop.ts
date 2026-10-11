import { useEffect, useState } from 'react'

/** 1024px：低于这个宽度放不下"侧边栏 + 列表 + 详情"三栏 */
const QUERY = '(min-width: 1024px)'

/**
 * 是否走桌面布局。
 *
 * 用 JS 判断而不是纯 CSS：两栏布局和单栏布局渲染的是**不同的组件树**
 * （桌面要同时挂列表和详情，移动端只挂一个），不是同一棵树的显隐问题。
 * 纯 CSS 的话两边都得渲染，移动端白白多挂一个详情组件。
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    setIsDesktop(mq.matches) // 首帧可能拿不到，补一次
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}
