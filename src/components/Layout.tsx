import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useIsDesktop } from '../hooks/useIsDesktop'
import Sidebar from './Sidebar'
import { BookmarkIcon, FilmIcon, PlusIcon, SettingsIcon } from './icons'

const TABS = [
  { to: '/', label: '日记', Icon: FilmIcon },
  { to: '/watchlist', label: '想看', Icon: BookmarkIcon },
  { to: '/settings', label: '设置', Icon: SettingsIcon },
]

export default function Layout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isDesktop = useIsDesktop()

  const showFab = pathname === '/' || pathname === '/watchlist'
  // 只有日记页走两栏。它自己管滚动，所以外层不能是滚动容器。
  const isTwoPane = isDesktop && pathname === '/'

  if (isDesktop) {
    return (
      <div className="flex h-dvh overflow-hidden bg-canvas">
        <Sidebar />

        <main
          className={
            isTwoPane
              ? 'min-w-0 flex-1 overflow-hidden'
              : 'min-w-0 flex-1 overflow-y-auto'
          }
        >
          <Outlet />
        </main>

        {showFab && (
          <button
            type="button"
            onClick={() => navigate('/new')}
            aria-label="添加记录"
            className="anim-fab-in fixed right-8 bottom-8 z-30 flex size-14 items-center justify-center rounded-full bg-ink text-canvas shadow-lg transition-transform duration-150 active:scale-[0.9]"
          >
            <PlusIcon size={24} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-2xl pb-28">
        <Outlet />
      </div>

      {showFab && (
        <button
          type="button"
          onClick={() => navigate('/new')}
          aria-label="添加记录"
          className="anim-fab-in fixed right-5 z-30 flex size-13 items-center justify-center rounded-full bg-ink text-canvas shadow-lg transition-transform duration-150 active:scale-[0.9]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.25rem)' }}
        >
          <PlusIcon size={22} />
        </button>
      )}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="flex-1">
              {({ isActive }) => (
                <span
                  className={`flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors duration-150 ${
                    isActive ? 'text-accent' : 'text-muted'
                  }`}
                >
                  <span
                    className={`transition-transform duration-200 ${
                      isActive ? 'scale-110' : 'scale-100'
                    }`}
                  >
                    <Icon size={21} />
                  </span>
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
