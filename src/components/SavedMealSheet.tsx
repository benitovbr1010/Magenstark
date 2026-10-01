import { useEffect, useState } from 'react'
import { goodMarkerLabels, markerLabels, mealTypeLabels } from '../lib/constants'
import { deleteSavedMeal, insertSavedMeal, updateSavedMeal, type SavedMealRow } from '../lib/savedMeals'
import { ToggleChip } from './ToggleChip'

type MealType = keyof typeof mealTypeLabels
type Marker = keyof typeof markerLabels
type GoodMarker = keyof typeof goodMarkerLabels

const mealTypeKeys = Object.keys(mealTypeLabels) as MealType[]
const markerKeys = Object.keys(markerLabels) as Marker[]
const goodMarkerKeys = Object.keys(goodMarkerLabels) as GoodMarker[]

export type SavedMealDraft = {
  summary: string
  meal_type: string
  main_foods: string[]
  markers: string[]
  good_markers: string[]
  good_foods: string[]
  fodmap_sources: string[]
}

export function SavedMealSheet({
  open,
  onClose,
  userId,
  existing,
  draft,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  userId: string
  existing?: SavedMealRow | null
  draft?: SavedMealDraft | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [mealType, setMealType] = useState<MealType>('snack')
  const [markers, setMarkers] = useState<Marker[]>([])
  const [goodMarkers, setGoodMarkers] = useState<GoodMarker[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const source = existing ?? draft
    setName(existing?.name ?? '')
    setSummary(source?.summary ?? '')
    setMealType((source?.meal_type as MealType) ?? 'snack')
    setMarkers((source?.markers as Marker[]) ?? [])
    setGoodMarkers((source?.good_markers as GoodMarker[]) ?? [])
  }, [open, existing, draft])

  if (!open) return null

  function toggleMarker(key: Marker) {
    setMarkers((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleGoodMarker(key: GoodMarker) {
    setGoodMarkers((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  async function handleSave() {
    if (!name.trim() || !summary.trim()) return
    setSaving(true)
    const source = existing ?? draft
    const payload = {
      user_id: userId,
      name: name.trim(),
      summary: summary.trim(),
      meal_type: mealType,
      main_foods: source?.main_foods ?? [],
      markers,
      good_markers: goodMarkers,
      good_foods: source?.good_foods ?? [],
      fodmap_sources: source?.fodmap_sources ?? [],
    }
    if (existing) {
      await updateSavedMeal(existing.id, payload)
    } else {
      await insertSavedMeal(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    await deleteSavedMeal(existing.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">
          {existing ? 'Mahlzeit bearbeiten' : 'Als eigene Mahlzeit merken'}
        </h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Name</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Mein Frühstück"
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-text outline-none focus:border-primary"
          />
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Mahlzeittyp</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {mealTypeKeys.map((key) => (
              <ToggleChip
                key={key}
                label={mealTypeLabels[key]}
                active={mealType === key}
                onClick={() => setMealType(key)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Zusammenfassung</p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Mögliche Auslöser</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {markerKeys.map((key) => (
              <ToggleChip
                key={key}
                label={markerLabels[key]}
                active={markers.includes(key)}
                onClick={() => toggleMarker(key)}
                tone="warning"
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Gut für dich</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {goodMarkerKeys.map((key) => (
              <ToggleChip
                key={key}
                label={goodMarkerLabels[key]}
                active={goodMarkers.includes(key)}
                onClick={() => toggleGoodMarker(key)}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!name.trim() || !summary.trim() || saving}
          onClick={handleSave}
          className="mt-5 w-full rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Speichern …' : 'Speichern'}
        </button>

        {existing && (
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="mt-3 w-full text-center text-sm font-medium text-warning"
          >
            Mahlzeit löschen
          </button>
        )}

        <button type="button" onClick={onClose} className="mt-3 w-full text-center text-sm text-text-secondary">
          Abbrechen
        </button>
      </div>
    </div>
  )
}
