import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toDateOnly } from '../lib/datetime'
import { fetchProfile } from '../lib/profile'
import {
  computeFellAsleepAt,
  DEFAULT_SLEEP_OFFSET_MINUTES,
  fetchSleepLog,
  formatDuration,
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

export function MorningCheckCard({
  userId,
  targetDate,
  variant,
  onDismiss,
  onSaved,
}: {
  userId: string
  targetDate: Date
  variant: 'banner' | 'inline'
  onDismiss?: () => void
  onSaved?: () => void
}) {
  const nightOf = new Date(targetDate)
  nightOf.setDate(nightOf.getDate() - 1)
  const isCurrentMorning = toDateOnly(targetDate) === toDateOnly(new Date())

  const [log, setLog] = useState<SleepLogRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(variant === 'banner')
  const [wakeTime, setWakeTime] = useState('')
  const [bedTime, setBedTime] = useState('')
  // Datum für "Ins Bett gegangen" frei einstellbar (z.B. bei Schlafenszeiten nach Mitternacht oder
  // beim nachträglichen Erfassen), damit die Schlafdauer korrekt berechnet wird.
  const [bedDate, setBedDate] = useState('')
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [offsetMinutes, setOffsetMinutes] = useState(DEFAULT_SLEEP_OFFSET_MINUTES)
  const [saving, setSaving] = useState(false)

  function resetFromLog(sleepLog: SleepLogRow | null) {
    setWakeTime(sleepLog?.woke_at ? timeInputValue(sleepLog.woke_at) : isCurrentMorning ? nowTimeInput() : '')
    setBedTime(sleepLog?.bed_at ? timeInputValue(sleepLog.bed_at) : '')
    setBedDate(sleepLog?.bed_at ? toDateOnly(new Date(sleepLog.bed_at)) : toDateOnly(nightOf))
    setQuality((sleepLog?.quality as 1 | 2 | 3 | 4 | 5) ?? 3)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchSleepLog(userId, nightOf), fetchProfile(userId)]).then(([sleepLog, profile]) => {
      setLog(sleepLog)
      setOffsetMinutes(profile?.sleep_offset_minutes ?? DEFAULT_SLEEP_OFFSET_MINUTES)
      resetFromLog(sleepLog)
      setEditing(variant === 'banner' ? !sleepLog?.quality : false)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, toDateOnly(targetDate)])

  if (loading) return null

  function handleCancel() {
    resetFromLog(log)
    setEditing(false)
  }

  const bedBaseDate = bedDate ? new Date(`${bedDate}T00:00:00`) : nightOf
  const bedIso = bedTime ? buildTimestamp(bedBaseDate, bedTime) : log?.bed_at ?? null
  const wakeIso = wakeTime ? buildTimestamp(targetDate, wakeTime) : null
  const durationMinutes = bedIso && wakeIso ? sleepDurationMinutes({ bed_at: bedIso, woke_at: wakeIso }) : null
  const savedDurationMinutes = log ? sleepDurationMinutes(log) : null

  async function handleSave() {
    if (!wakeTime) return
    setSaving(true)
    const fellAsleepIso =
      bedIso && !log?.fell_asleep_at ? computeFellAsleepAt(new Date(bedIso), offsetMinutes).toISOString() : (log?.fell_asleep_at ?? null)
    await upsertSleepLog(userId, nightOf, {
      woke_at: wakeIso,
      quality,
      ...(bedTime ? { bed_at: bedIso, fell_asleep_at: fellAsleepIso } : {}),
    })
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
          {log?.quality
            ? `Geschlafen: ${log.quality}/5${savedDurationMinutes != null ? ` · ${formatDuration(savedDurationMinutes)}` : ''}`
            : 'Wie hast du geschlafen?'}
        </span>
        <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
      </button>
    )
  }

  const wrapperClass =
    variant === 'banner'
      ? 'mt-3 rounded-2xl bg-primary-light px-4 py-4'
      : 'mt-4 rounded-2xl border border-border bg-card px-4 py-4'

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {variant === 'inline' && (
            <button type="button" onClick={handleCancel} aria-label="Zurück" className="shrink-0 text-text-tertiary">
              <ChevronLeft size={18} />
            </button>
          )}
          <p className="text-sm font-medium text-text">Guten Morgen, wie hast du geschlafen?</p>
        </div>
        {variant === 'banner' && onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Schließen" className="shrink-0 text-text-tertiary">
            <X size={16} />
          </button>
        )}
      </div>

      {!log?.bed_at && (
        <div className="mt-3">
          <span className="text-xs text-text-tertiary">Ins Bett gegangen</span>
          <div className="mt-1 flex gap-2">
            <input
              type="date"
              value={bedDate}
              onChange={(e) => setBedDate(e.target.value)}
              aria-label="Datum"
              className="flex-1 rounded-2xl border border-border bg-card px-4 py-2 text-text outline-none focus:border-primary"
            />
            <input
              type="time"
              value={bedTime}
              onChange={(e) => setBedTime(e.target.value)}
              aria-label="Uhrzeit"
              className="w-28 rounded-2xl border border-border bg-card px-4 py-2 text-text outline-none focus:border-primary"
            />
          </div>
        </div>
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

      {durationMinutes != null && <p className="mt-3 text-xs text-text-tertiary">Schlafdauer: {formatDuration(durationMinutes)}</p>}

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
