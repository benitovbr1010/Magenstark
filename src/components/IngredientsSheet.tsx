import { useEffect, useState } from 'react'
import { goodMarkerLabels, markerLabels } from '../lib/constants'
import {
  fetchAllIngredientProfiles,
  fodmapTypeLabels,
  updateIngredientProfile,
  type IngredientProfileRow,
} from '../lib/ingredientProfiles'
import { ToggleChip } from './ToggleChip'

type MarkerKey = keyof typeof markerLabels
type GoodMarkerKey = keyof typeof goodMarkerLabels
type FodmapTypeKey = keyof typeof fodmapTypeLabels

// Zubereitungs-Marker gehören nicht zu einer Zutat (siehe analyze-meal), daher hier nicht wählbar.
const ingredientMarkerKeys = (Object.keys(markerLabels) as MarkerKey[]).filter(
  (k) => k !== 'fettig_frittiert' && k !== 'scharf',
)
// ausreichend_getrunken läuft über das Wassertracking, nicht über Zutaten.
const ingredientGoodMarkerKeys = (Object.keys(goodMarkerLabels) as GoodMarkerKey[]).filter(
  (k) => k !== 'ausreichend_getrunken',
)
const fodmapTypeKeys = Object.keys(fodmapTypeLabels) as FodmapTypeKey[]

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

/** Liste aller bewerteten Zutaten mit Korrekturmöglichkeit. Korrekturen wirken rückwirkend auf alle
 * Mahlzeiten, die diese Zutat enthalten, da Marker nie dauerhaft pro Mahlzeit gespeichert, sondern bei
 * der Anzeige/Auswertung live aus ingredient_profiles berechnet werden. */
export function IngredientsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profiles, setProfiles] = useState<IngredientProfileRow[]>([])
  const [selected, setSelected] = useState<IngredientProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setSelected(null)
    setLoading(true)
    fetchAllIngredientProfiles().then((rows) => {
      setProfiles(rows)
      setLoading(false)
    })
  }, [open])

  if (!open) return null

  async function toggleMarker(key: MarkerKey) {
    if (!selected) return
    const next = selected.markers.includes(key) ? selected.markers.filter((m) => m !== key) : [...selected.markers, key]
    const updated = { ...selected, markers: next }
    setSelected(updated)
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    await updateIngredientProfile(selected.id, { markers: next })
  }

  async function toggleGoodMarker(key: GoodMarkerKey) {
    if (!selected) return
    const next = selected.good_markers.includes(key)
      ? selected.good_markers.filter((m) => m !== key)
      : [...selected.good_markers, key]
    const updated = { ...selected, good_markers: next }
    setSelected(updated)
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    await updateIngredientProfile(selected.id, { good_markers: next })
  }

  async function toggleFodmapType(key: FodmapTypeKey) {
    if (!selected) return
    const next = selected.fodmap_types.includes(key)
      ? selected.fodmap_types.filter((f) => f !== key)
      : [...selected.fodmap_types, key]
    const updated = { ...selected, fodmap_types: next }
    setSelected(updated)
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    await updateIngredientProfile(selected.id, { fodmap_types: next })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text">{selected ? capitalize(selected.name) : 'Zutaten-Bewertungen'}</h2>
          <button
            type="button"
            onClick={() => (selected ? setSelected(null) : onClose())}
            className="text-sm font-medium text-primary-text"
          >
            {selected ? 'Zurück' : 'Schließen'}
          </button>
        </div>

        {loading ? null : selected ? (
          <div className="mt-4 flex flex-col gap-4">
            {selected.note && <p className="text-xs text-text-tertiary">{selected.note}</p>}
            <div>
              <p className="text-sm font-medium text-text">Mögliche Auslöser</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ingredientMarkerKeys.map((key) => (
                  <ToggleChip
                    key={key}
                    label={markerLabels[key]}
                    tone="warning"
                    active={selected.markers.includes(key)}
                    onClick={() => toggleMarker(key)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-text">Gut für dich</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ingredientGoodMarkerKeys.map((key) => (
                  <ToggleChip
                    key={key}
                    label={goodMarkerLabels[key]}
                    active={selected.good_markers.includes(key)}
                    onClick={() => toggleGoodMarker(key)}
                  />
                ))}
              </div>
            </div>
            {selected.markers.includes('fodmap_hoch') && (
              <div>
                <p className="text-sm font-medium text-text">FODMAP-Art</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {fodmapTypeKeys.map((key) => (
                    <ToggleChip
                      key={key}
                      label={fodmapTypeLabels[key]}
                      active={selected.fodmap_types.includes(key)}
                      onClick={() => toggleFodmapType(key)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {profiles.length === 0 && (
              <p className="text-sm text-text-tertiary">Noch keine Zutaten bewertet. Sie entstehen automatisch beim Erfassen von Mahlzeiten.</p>
            )}
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="flex items-center justify-between rounded-2xl border border-border bg-background p-3 text-left"
              >
                <span className="text-sm font-medium text-text">{capitalize(p.name)}</span>
                <span className="text-xs text-text-tertiary">{p.markers.length + p.good_markers.length} Marker</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
