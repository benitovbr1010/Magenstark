import { useEffect, useState } from 'react'
import { stepStatusLabels } from '../lib/constants'
import type { Database } from '../lib/database.types'
import { toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'
import { ToggleChip } from './ToggleChip'

type StepRow = Database['public']['Tables']['steps']['Row']
type StepStatus = keyof typeof stepStatusLabels

const statusKeys = Object.keys(stepStatusLabels) as StepStatus[]

export function StepSheet({
  open,
  onClose,
  userId,
  step,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  userId: string
  step: StepRow | null
  nextSortOrder: number
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<StepStatus>('open')
  const [date, setDate] = useState(toDateOnly(new Date()))
  const [resultShort, setResultShort] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(step?.title ?? '')
    setStatus((step?.status as StepStatus) ?? 'open')
    setDate(step?.date ?? toDateOnly(new Date()))
    setResultShort(step?.result_short ?? '')
  }, [open, step])

  if (!open) return null

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const payload = {
      user_id: userId,
      title: title.trim(),
      status,
      date: status === 'open' ? null : date,
      result_short: resultShort.trim() || null,
      ...(step ? {} : { sort_order: nextSortOrder }),
    }
    const { error } = step
      ? await supabase.from('steps').update(payload).eq('id', step.id)
      : await supabase.from('steps').insert(payload)
    setSaving(false)
    if (!error) {
      onSaved()
      onClose()
    }
  }

  async function handleDelete() {
    if (!step) return
    setSaving(true)
    await supabase.from('steps').delete().eq('id', step.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">{step ? 'Schritt bearbeiten' : 'Schritt hinzufügen'}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Blutbild"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
          />

          <div>
            <p className="text-sm font-medium text-text">Status</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {statusKeys.map((key) => (
                <ToggleChip
                  key={key}
                  label={stepStatusLabels[key]}
                  active={status === key}
                  onClick={() => setStatus(key)}
                />
              ))}
            </div>
          </div>

          {status !== 'open' && (
            <label>
              <span className="text-xs text-text-tertiary">Datum</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              />
            </label>
          )}

          {status === 'done' && (
            <input
              value={resultShort}
              onChange={(e) => setResultShort(e.target.value)}
              placeholder="Ergebnis (kurz), z. B. unauffällig"
              className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
            />
          )}
        </div>

        <button
          type="button"
          disabled={!title.trim() || saving}
          onClick={handleSave}
          className="mt-5 w-full rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Speichern …' : 'Speichern'}
        </button>

        <div className="mt-3 flex justify-between">
          <button type="button" onClick={onClose} className="text-sm font-medium text-text-secondary">
            Abbrechen
          </button>
          {step && (
            <button type="button" disabled={saving} onClick={handleDelete} className="text-sm font-medium text-warning">
              Löschen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
