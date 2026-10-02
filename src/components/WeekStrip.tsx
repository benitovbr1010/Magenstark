import { getWeekDates, isSameDay, startOfDay, toDateOnly } from '../lib/datetime'

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function WeekStrip({
  selected,
  onSelect,
  closedDates = new Set<string>(),
}: {
  selected: Date
  onSelect: (date: Date) => void
  /** Daten (YYYY-MM-DD), für die bereits ein Tagesabschluss existiert. Fehlende vergangene Tage bekommen einen Punkt. */
  closedDates?: Set<string>
}) {
  const days = getWeekDates(new Date())
  const todayStart = startOfDay(new Date())

  return (
    <div className="flex justify-between px-4">
      {days.map((day, i) => {
        const isSelected = isSameDay(day, selected)
        const isPast = day.getTime() < todayStart.getTime()
        const missingClosing = isPast && !closedDates.has(toDateOnly(day))
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            className="flex flex-col items-center gap-1"
          >
            <span className="text-xs text-text-tertiary">{weekdayLabels[i]}</span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                isSelected ? 'bg-primary text-white' : 'text-text'
              }`}
            >
              {day.getDate()}
            </span>
            <span className={`h-1 w-1 rounded-full ${missingClosing ? 'bg-text-tertiary' : 'bg-transparent'}`} />
          </button>
        )
      })}
    </div>
  )
}
