import { Calendar, CalendarDays, Route } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Heute', icon: Calendar, end: true },
  { to: '/woche', label: 'Woche', icon: CalendarDays, end: false },
  { to: '/mein-weg', label: 'Mein Weg', icon: Route, end: false },
] as const

export function TabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-xs ${
                  isActive ? 'text-primary-text' : 'text-text-tertiary'
                }`
              }
            >
              <Icon size={22} strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
