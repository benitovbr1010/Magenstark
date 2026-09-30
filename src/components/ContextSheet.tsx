import { useEffect, useState } from 'react'
import { fetchKnownPlaces, type ActiveContext } from '../lib/context'
import { phaseDescriptions, phaseLabels } from '../lib/constants'
import { toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'
import { Switch } from './Switch'
import { ToggleChip } from './ToggleChip'

const phaseKeys = Object.keys(phaseLabels) as (keyof typeof phaseLabels)[]

export function ContextSheet({
  open,
  onClose,
  userId,
  currentContext,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  userId: string
  currentContext: ActiveContext | null
  onSaved: () => void
}) {
  const [places, setPlaces] = useState<string[]>([])
  const [place, setPlace] = useState('')
  const [addingPlace, setAddingPlace] = useState(false)
  const [newPlace, setNewPlace] = useState('')
  const [startDate, setStartDate] = useState(toDateOnly(new Date()))
  const [endDate, setEndDate] = useState(toDateOnly(new Date()))
  const [noEndDate, setNoEndDate] = useState(true)
  const [phase, setPhase] = useState<keyof typeof phaseLabels>('alltag')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchKnownPlaces(userId).then(setPlaces)
    if (currentContext) {
      setPlace(currentContext.place)
      setPhase(currentContext.phase)
      setStartDate(currentContext.start_date)
      setNoEndDate(!currentContext.end_date)
      setEndDate(currentContext.end_date ?? toDateOnly(new Date()))
    } else {
      setPlace('')
      setPhase('alltag')
      setStartDate(toDateOnly(new Date()))
      setEndDate(toDateOnly(new Date()))
      setNoEndDate(true)
    }
  }, [open, userId, currentContext])

  if (!open) return null

  async function handleSave() {
    if (!place.trim()) return
    setSaving(true)
    const { error } = await supabase.from('contexts').insert({
      user_id: userId,
      place: place.trim(),
      phase,
      start_date: startDate,
      end_date: noEndDate ? null : endDate,
    })
    setSaving(false)
    if (!error) {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">Wo bist du gerade?</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Ort</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {places.map((p) => (
              <ToggleChip key={p} label={p} active={place === p} onClick={() => setPlace(p)} />
            ))}
            {addingPlace ? (
              <input
                autoFocus
                value={newPlace}
                onChange={(e) => setNewPlace(e.target.value)}
                onBlur={() => {
                  if (newPlace.trim()) {
                    setPlace(newPlace.trim())
                    setPlaces((prev) => [...prev, newPlace.trim()])
                  }
                  setAddingPlace(false)
                  setNewPlace('')
                }}
                placeholder="Ort eingeben"
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
              />
            ) : (
              <ToggleChip label="+ Ort hinzufügen" active={false} onClick={() => setAddingPlace(true)} />
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Zeitraum</p>
          <div className="mt-2 flex gap-3">
            <label className="flex-1">
              <span className="text-xs text-text-tertiary">von</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs text-text-tertiary">bis</span>
              <input
                type="date"
                value={endDate}
                disabled={noEndDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary disabled:opacity-40"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-text">Kein Enddatum</span>
            <Switch checked={noEndDate} onChange={setNoEndDate} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Phase</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {phaseKeys.map((key) => (
              <ToggleChip key={key} label={phaseLabels[key]} active={phase === key} onClick={() => setPhase(key)} />
            ))}
          </div>
          <p className="mt-2 text-xs text-text-secondary">{phaseDescriptions[phase]}</p>
        </div>

        <button
          type="button"
          disabled={!place.trim() || saving}
          onClick={handleSave}
          className="mt-5 w-full rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Speichern …' : 'Übernehmen'}
        </button>
      </div>
    </div>
  )
}
