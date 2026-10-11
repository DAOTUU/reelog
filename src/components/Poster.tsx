import { usePosterUrl } from '../hooks/usePosterUrl'
import { FilmIcon } from './icons'

export default function Poster({
  posterKey,
  className = '',
}: {
  posterKey?: string
  className?: string
}) {
  const url = usePosterUrl(posterKey)

  // 没有海报时给一个中性占位，不发起任何网络请求。
  if (!url) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-2 text-line ${className}`}
        aria-hidden
      >
        <FilmIcon size={18} />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`object-cover ${className}`}
    />
  )
}
