import { popElement } from '../lib/motion'
import { StarIcon } from './icons'

/**
 * 可点击的评分选择器。
 *
 * 每颗星独立渲染自己的填充状态（而不是像只读展示那样靠整体裁切），
 * 所以半星永远精确对齐；每颗星左右各一个点击区，左半 = x.5，右半 = x.0。
 */
export default function StarPicker({
  value,
  onChange,
  size = 32,
}: {
  value: number
  onChange: (next: number) => void
  size?: number
}) {
  // 点哪颗就弹哪颗，给一次触觉般的即时反馈。
  // 目标元素取按钮的父节点（包住这颗星的那个 span）。
  function pick(e: React.MouseEvent<HTMLButtonElement>, next: number) {
    onChange(next)
    popElement(e.currentTarget.parentElement)
  }

  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4].map((i) => {
        const full = i + 1
        const filled = value >= full
        const half = !filled && value >= i + 0.5

        return (
          <span key={i} className="relative inline-flex">
            <StarIcon
              size={size}
              className={filled ? 'text-accent' : 'text-line'}
            />
            {half && (
              <span
                className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: '50%' }}
              >
                <StarIcon size={size} className="shrink-0 text-accent" />
              </span>
            )}

            <button
              type="button"
              aria-label={`${i + 0.5} 分`}
              onClick={(e) => pick(e, i + 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              aria-label={`${full} 分`}
              onClick={(e) => pick(e, full)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        )
      })}
    </div>
  )
}
