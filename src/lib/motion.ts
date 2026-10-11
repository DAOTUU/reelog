/**
 * 系统是否开启了「减弱动态效果」。
 *
 * 所有用 JS 驱动的动画都必须先问这个——CSS 动画由 index.css 里的
 * media query 统一兜底，但 Web Animations API 不受它约束，得自己判。
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * 让元素弹一下。用 Web Animations API 而不是切 class——
 * 后者需要靠重新挂载组件来重放动画，会把内部的焦点和状态一起弄丢。
 */
export function popElement(el: Element | null | undefined, scale = 1.22) {
  if (!el || prefersReducedMotion()) return
  el.animate(
    [
      { transform: 'scale(1)' },
      { transform: `scale(${scale})` },
      { transform: 'scale(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.32,.72,0,1)' },
  )
}
