import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addDays, toDateOnly } from '../lib/datetime'
import {
  fetchSleepLog,
  formatDuration,
  isPlausibleSleepDuration,
  sleepDurationMinutes,
  upsertSleepLog,
  type SleepLogRow,
} from '../lib/sleep'

const levels = [1, 2, 3, 4, 5] as const

function RatingDots({ value, onChange }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <div className="flex gap-3">
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          aria-label={`Stufe ${level}`}
          onClick={() => onChange(level)}
          className={`h-8 w-8 rounded-full border ${
            value >= level ? 'border-primary bg-primary' : 'border-border bg-card'
          }`}
        />
      ))}
    </div>
  )
}

function nowTimeInput(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function timeInputValue(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toTimeString().slice(0, 5)
}

function buildTimestamp(baseDate: Date, timeStr: string): string | null {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date(baseDate)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** "Wie hast du geschlafen?"-Karte für einen Tag (targetDate = Morgen danach). Enthält NUR Schlafqualität
 * und Weckzeit – die Bettzeit kommt ausschließlich aus dem Tagesabschluss des Vorabends (night_of). */
export function MorningCheckCard({
  userId,
  targetDate,
  onDismiss,
  onSaved,
}: {
  userId: string
  targetDate: Date
  onDismiss?: () => void
  onSaved?: () => void
}) {
  const nightOf = addDays(targetDate, -1)
  const isCurrentMorning = toDateOnly(targetDate) === toDateOnly(new Date())

  const [log, setLog] = useState<SleepLogRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(true)
  const [wakeTime, setWakeTime] = useState('')
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [saving, setSaving] = useState(false)

  function resetFromLog(sleepLog: SleepLogRow | null) {
    setWakeTime(sleepLog?.woke_at ? timeInputValue(sleepLog.woke_at) : isCurrentMorning ? nowTimeInput() : '')
    setQuality((sleepLog?.quality as 1 | 2 | 3 | 4 | 5) ?? 3)
  }

  useEffect(() => {
    setLoading(true)
    fetchSleepLog(userId, nightOf).then((sleepLog) => {
      setLog(sleepLog)
      resetFromLog(sleepLog)
      setEditing(!sleepLog?.quality)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, toDateOnly(targetDate)])

  if (loading) return null

  function handleCancel() {
    resetFromLog(log)
    setEditing(false)
  }

  const wakeIso = wakeTime ? buildTimestamp(targetDate, wakeTime) : null
  const durationMinutes =
    log?.bed_at && wakeIso
      ? sleepDurationMinutes({ bed_at: log.bed_at, fell_asleep_at: log.fell_asleep_at, woke_at: wakeIso })
      : null
  const savedDurationMinutes = log ? sleepDurationMinutes(log) : null
  const savedDurationImplausible = savedDurationMinutes != null && !isPlausibleSleepDuration(savedDurationMinutes)

  async function handleSave() {
    if (!wakeTime) return
    setSaving(true)
    await upsertSleepLog(userId, nightOf, { woke_at: wakeIso, quality })
    const refreshed = await fetchSleepLog(userId, nightOf)
    setLog(refreshed)
    setSaving(false)
    setEditing(false)
    onSaved?.()
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-text">
          Aufgewacht {timeInputValue(log?.woke_at ?? null)} · Schlaf {log?.quality}/5
          {savedDurationMinutes != null ? ` · ${formatDuration(savedDurationMinutes)}` : ''}
          {savedDurationImplausible && <span className="ml-1 text-warning">· Bitte Zeiten prüfen</span>}
        </span>
        <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
      </button>
    )
  }

  const wrapperClass = !log?.quality
    ? 'mt-4 rounded-2xl bg-primary-light px-4 py-4'
    : 'mt-4 rounded-2xl border border-border bg-card px-4 py-4'

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {log?.quality && (
            <button type="button" onClick={handleCancel} aria-label="Zurück" className="shrink-0 text-text-tertiary">
              <ChevronLeft size={18} />
            </button>
          )}
          <p className="text-sm font-medium text-text">Guten Morgen, wie hast du geschlafen?</p>
        </div>
        {!log?.quality && onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Schließen" className="shrink-0 text-text-tertiary">
            <X size={16} />
          </button>
        )}
      </div>

      {!log?.bed_at && (
        <p className="mt-3 text-xs text-text-tertiary">
          Bettzeit fehlt noch – trag sie im Tagesabschluss des Vorabends ein.
        </p>
      )}

      <label className="mt-3 block">
        <span className="text-xs text-text-tertiary">Aufgewacht</span>
        <input
          type="time"
          value={wakeTime}
          onChange={(e) => setWakeTime(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-2 text-text outline-none focus:border-primary"
        />
      </label>

      <div className="mt-3">
        <RatingDots value={quality} onChange={setQuality} />
        <div className="mt-1 flex justify-between text-xs text-text-tertiary" style={{ maxWidth: '9.5rem' }}>
          <span>schlecht</span>
          <span>gut</span>
        </div>
      </div>

      {durationMinutes != null && (
        <p className="mt-3 text-xs text-text-tertiary">
          Schlafdauer: {formatDuration(durationMinutes)}
          {!isPlausibleSleepDuration(durationMinutes) && <span className="ml-1 text-warning">· Bitte Zeiten prüfen</span>}
        </p>
      )}

      <button
        type="button"
        disabled={saving || !wakeTime}
        onClick={handleSave}
        className="mt-3 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? 'Speichern …' : 'Speichern'}
      </button>
    </div>
  )
}
