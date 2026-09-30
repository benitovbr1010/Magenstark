import { formatGermanDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/datetime'

export function DateTimeField({
  value,
  onChange,
  variant = 'card',
}: {
  value: Date
  onChange: (date: Date) => void
  variant?: 'card' | 'plain'
}) {
  return (
    <div
      className={
        variant === 'card'
          ? 'relative rounded-2xl border border-border bg-card px-4 py-3'
          : 'relative inline-block'
      }
    >
      <span
        className={`pointer-events-none ${
          variant === 'card' ? 'text-sm font-medium text-text' : 'text-sm text-text-secondary'
        }`}
      >
        {formatGermanDateTime(value)}
      </span>
      <input
        type="datetime-local"
        value={toDatetimeLocalValue(value)}
        onChange={(e) => onChange(fromDatetimeLocalValue(e.target.value))}
        aria-label="Datum und Uhrzeit"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  )
}
