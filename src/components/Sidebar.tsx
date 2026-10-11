import { NavLink } from 'react-router-dom'
import { BookmarkIcon, FilmIcon, SettingsIcon } from './icons'

const TABS = [
  { to: '/', label: '日记', Icon: FilmIcon },
  { to: '/watchlist', label: '想看', Icon: BookmarkIcon },
  { to: '/settings', label: '设置', Icon: SettingsIcon },
]

/** 桌面端的左侧导航。移动端对应的是底部 tab 栏。 */
export default function Sidebar() {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5">
      <div className="flex items-center gap-2.5 px-2 pb-7">
        <img src="/icons/icon-192.png" alt="" className="size-9 rounded-xl" />
        <span className="text-title text-ink">Reelog</span>
      </div>

      <nav className="flex flex-col gap-1">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ${
                isActive
                  ? 'bg-surface-2 font-medium text-ink'
                  : 'text-ink-2 hover:bg-surface-2'
              }`
            }
          >
            <Icon size={18} />
            <span className="text-body">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <NavLink
          to="/credits"
          className="block rounded-lg px-3 py-2.5 text-meta text-muted transition-colors duration-150 hover:bg-surface-2"
        >
          关于与署名
        </NavLink>
      </div>
    </aside>
  )
}
