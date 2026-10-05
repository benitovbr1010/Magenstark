import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getWeekDates, isSameDay, startOfDay, toDateOnly } from '../lib/datetime'

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Wochenstreifen mit Vor/Zurück-Navigation, damit auch vergangene Wochen (z.B. Mahlzeiten älterer Tage)
 * einsehbar sind, nicht nur die aktuelle Kalenderwoche. */
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
  const [weekStart, setWeekStart] = useState(() => getWeekDates(selected)[0])
  const days = getWeekDates(weekStart)
  const todayStart = startOfDay(new Date())

  useEffect(() => {
    if (!days.some((d) => isSameDay(d, selected))) {
      setWeekStart(getWeekDates(selected)[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  function shiftWeek(deltaDays: number) {
    setWeekStart((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + deltaDays)
      return next
    })
  }

  return (
    <div className="flex items-center gap-1 px-1">
      <button type="button" onClick={() => shiftWeek(-7)} aria-label="Vorherige Woche" className="shrink-0 p-1">
        <ChevronLeft size={18} className="text-text-tertiary" />
      </button>
      <div className="flex flex-1 justify-between">
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
      <button type="button" onClick={() => shiftWeek(7)} aria-label="Nächste Woche" className="shrink-0 p-1">
        <ChevronRight size={18} className="text-text-tertiary" />
      </button>
    </div>
  )
}
