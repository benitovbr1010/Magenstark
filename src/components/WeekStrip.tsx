import { getWeekDates, isSameDay } from '../lib/datetime'

const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function WeekStrip({
  selected,
  onSelect,
}: {
  selected: Date
  onSelect: (date: Date) => void
}) {
  const days = getWeekDates(new Date())

  return (
    <div className="flex justify-between px-4">
      {days.map((day, i) => {
        const isSelected = isSameDay(day, selected)
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
          </button>
        )
      })}
    </div>
  )
}
