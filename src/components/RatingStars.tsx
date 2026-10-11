import { RATING_MAX } from '../lib/constants'
import { StarIcon } from './icons'

function Row({ size, className }: { size: number; className: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`}>
      {Array.from({ length: RATING_MAX }, (_, i) => (
        // shrink-0 是关键：覆盖层被裁到 pct% 宽后，若星星可收缩，
        // 实心星会比底下的空星窄，导致半星位置整体错位。
        <StarIcon key={i} size={size} className="shrink-0" />
      ))}
    </span>
  )
}

/**
 * 半星实现：底层画一排空星，上面叠一排实心星并用宽度裁切。
 * 覆盖层内的星星必须 shrink-0，否则会被压缩、与底层错位。
 */
export default function RatingStars({
  value,
  size = 13,
}: {
  value: number
  size?: number
}) {
  const pct = Math.max(0, Math.min(1, value / RATING_MAX)) * 100

  return (
    <span
      className="relative inline-flex align-middle"
      aria-label={`评分 ${value} 分`}
    >
      <Row size={size} className="text-line" />
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        <Row size={size} className="text-accent" />
      </span>
    </span>
  )
}
