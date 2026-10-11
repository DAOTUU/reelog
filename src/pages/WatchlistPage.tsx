import { Link } from 'react-router-dom'
import Poster from '../components/Poster'
import { useWatchlist } from '../hooks/useWatchlist'

const STAGGER_MS = 16
const STAGGER_CAP = 6

export default function WatchlistPage() {
  const items = useWatchlist()

  return (
    <>
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="px-5 pt-4 pb-3.5">
          <h1 className="text-display text-ink">想看</h1>
          <p className="text-meta mt-1 text-muted">{items.length} 部待看</p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="px-6 pt-24 text-center">
          <p className="text-title text-ink">还没有想看的</p>
          <p className="text-meta mt-2 leading-relaxed text-muted">
            点右下角的 + 添加，或者从已看记录里挪过来。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 px-5 pt-4">
          {items.map((w, i) => (
            <Link
              key={w.id}
              to={`/watchlist/${w.id}`}
              style={{
                animationDelay: `${Math.min(i, STAGGER_CAP) * STAGGER_MS}ms`,
              }}
              className="anim-fade-up block transition-opacity duration-150 active:opacity-55"
            >
              <Poster
                posterKey={w.posterKey}
                className="aspect-[2/3] w-full rounded-lg"
              />
              <h3 className="text-meta mt-2 truncate font-medium text-ink">
                {w.title}
              </h3>
              <p className="text-meta truncate text-muted">
                {w.note || (w.year !== null ? `${w.year} 年` : '')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
