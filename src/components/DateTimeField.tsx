import {
  formatGermanDateTime,
  minutesAgo,
  toDateInputValue,
  toTimeInputValue,
  withDatePart,
  withTimePart,
} from '../lib/datetime'

const quickOptions = [
  { label: 'Jetzt', minutes: 0 },
  { label: 'vor 30 Min', minutes: 30 },
  { label: 'vor 1 Std', minutes: 60 },
  { label: 'vor 2 Std', minutes: 120 },
]

export function DateTimeField({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-sm font-medium text-text">{formatGermanDateTime(value)}</p>
      <div className="mt-2 flex gap-2">
        <input
          type="date"
          value={toDateInputValue(value)}
          onChange={(e) => onChange(withDatePart(value, e.target.value))}
          aria-label="Datum"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
        <input
          type="time"
          value={toTimeInputValue(value)}
          onChange={(e) => onChange(withTimePart(value, e.target.value))}
          aria-label="Uhrzeit"
          className="w-28 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {quickOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(minutesAgo(option.minutes))}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
