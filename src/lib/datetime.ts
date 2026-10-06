export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): Date {
  return new Date(value)
}

export function toDateInputValue(date: Date): string {
  return toDateOnly(date)
}

export function toTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Übernimmt das Datum aus datePart (YYYY-MM-DD) und die Uhrzeit aus base. */
export function withDatePart(base: Date, datePart: string): Date {
  const [y, m, d] = datePart.split('-').map(Number)
  const next = new Date(base)
  if (y && m && d) next.setFullYear(y, m - 1, d)
  return next
}

/** Übernimmt die Uhrzeit aus timePart (HH:MM) und das Datum aus base. */
export function withTimePart(base: Date, timePart: string): Date {
  const [h, min] = timePart.split(':').map(Number)
  const next = new Date(base)
  if (!Number.isNaN(h) && !Number.isNaN(min)) next.setHours(h, min, 0, 0)
  return next
}

/** Aktuelle Uhrzeit, aber am angegebenen Kalendertag (für rückwirkend ausgewählte Tage). */
export function nowOnDate(date: Date): Date {
  return withDatePart(new Date(), toDateOnly(date))
}

export function minutesAgo(minutes: number, from = new Date()): Date {
  const next = new Date(from)
  next.setMinutes(next.getMinutes() - minutes)
  return next
}

export function formatGermanDateTime(date: Date): string {
  const datePart = date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const timePart = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} · ${timePart}`
}

export function formatGermanDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatGermanTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function toDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Minuten seit Mitternacht -> "HH:MM" (für Zeit-Einstellungen wie "Morgen-Check ab"). */
export function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" -> Minuten seit Mitternacht. */
export function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Kurzes Datum für Chips, z.B. "Di., 6.10." */
export function formatChipDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

/** Woche beginnt Montag. */
export function getWeekDates(reference: Date): Date[] {
  const day = reference.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = startOfDay(reference)
  monday.setDate(reference.getDate() + diffToMonday)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}
