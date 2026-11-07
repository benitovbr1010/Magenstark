import { Camera, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DateTimeField } from '../components/DateTimeField'
import { MarkerChip } from '../components/MarkerChip'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToggleChip } from '../components/ToggleChip'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { useAuth } from '../lib/AuthContext'
import { goodMarkerLabels, markerLabels, mealTypeLabels } from '../lib/constants'
import { fetchLatestContext, type ActiveContext } from '../lib/context'
import { nowOnDate, withDatePart, withTimePart } from '../lib/datetime'
import { extractMealSegments, fileToBase64Image } from '../lib/extractMeals'
import type { IngredientDetails } from '../lib/ingredientProfiles'
import { supabase } from '../lib/supabaseClient'

type MealType = keyof typeof mealTypeLabels
const mealTypeKeys = Object.keys(mealTypeLabels) as MealType[]

type Draft = {
  id: string
  eatenAt: Date
  mealType: MealType
  rawText: string
  summary: string
  main_foods: string[]
  markers: string[]
  good_markers: string[]
  good_foods: string[]
  ingredients: string[]
  ingredient_details: IngredientDetails
  prep_markers: string[]
  fodmap_sources: string[]
}

export function BatchMeal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const { session } = useAuth()

  const baseDate = dateParam ? withDatePart(new Date(), dateParam) : new Date()

  const [rawText, setRawText] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!session) return
    fetchLatestContext(session.user.id).then(setActiveContext)
  }, [session])

  function addImages(files: FileList | null) {
    if (!files) return
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, 6))
  }

  async function handleAnalyze() {
    if (!rawText.trim() && images.length === 0) return
    setAnalyzing(true)
    setError(null)
    const imageInputs = await Promise.all(images.map(fileToBase64Image))
    const segments = await extractMealSegments({
      text: rawText.trim() || undefined,
      images: imageInputs.length > 0 ? imageInputs : undefined,
    })
    if (!segments || segments.length === 0) {
      setAnalyzing(false)
      setError('Es konnten keine Mahlzeiten erkannt werden. Bitte anders formulieren oder ein anderes Foto wählen.')
      return
    }

    const now = new Date()
    const results = await Promise.all(
      segments.map(async (segment) => {
        const { data } = await supabase.functions.invoke('analyze-meal', {
          body: { text: segment.text, currentTime: now.toISOString() },
        })
        let eatenAt = nowOnDate(baseDate)
        if (segment.time_hint) {
          const [h, m] = segment.time_hint.split(':').map(Number)
          if (!Number.isNaN(h) && !Number.isNaN(m)) eatenAt = withTimePart(baseDate, segment.time_hint)
        }
        const draft: Draft = {
          id: crypto.randomUUID(),
          eatenAt,
          mealType: segment.meal_type,
          rawText: segment.text,
          summary: data?.summary ?? segment.text,
          main_foods: data?.main_foods ?? [],
          markers: data?.markers ?? [],
          good_markers: data?.good_markers ?? [],
          good_foods: data?.good_foods ?? [],
          ingredients: data?.ingredients ?? [],
          ingredient_details: (data?.ingredient_details as IngredientDetails) ?? {},
          prep_markers: data?.prep_markers ?? [],
          fodmap_sources: data?.fodmap_sources ?? [],
        }
        return draft
      }),
    )

    setAnalyzing(false)
    setDrafts(results.sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime()))
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => (prev ? prev.map((d) => (d.id === id ? { ...d, ...patch } : d)) : prev))
  }

  function removeDraft(id: string) {
    setDrafts((prev) => (prev ? prev.filter((d) => d.id !== id) : prev))
  }

  async function handleSaveAll() {
    if (!session || !drafts || drafts.length === 0) return
    setSaving(true)
    const payload = drafts.map((d) => ({
      user_id: session.user.id,
      eaten_at: d.eatenAt.toISOString(),
      meal_type: d.mealType,
      raw_text: d.rawText,
      summary: d.summary,
      main_foods: d.main_foods,
      markers: d.markers,
      good_markers: d.good_markers,
      good_foods: d.good_foods,
      ingredients: d.ingredients,
      ingredient_details: d.ingredient_details,
      prep_markers: d.prep_markers,
      fodmap_sources: d.fodmap_sources,
      portion: null,
      eaten_quickly: false,
      place: activeContext?.place ?? null,
      phase: activeContext?.phase ?? null,
    }))
    const { error: saveError } = await supabase.from('meals').insert(payload)
    setSaving(false)
    if (!saveError) navigate('/')
  }

  return (
    <div className="pb-10">
      <ScreenHeader title="Mehrere Mahlzeiten" subtitle="Nachtragen, was du heute gegessen hast" />

      <div className="mt-4 flex flex-col gap-6 px-4">
        {!drafts ? (
          <>
            <div className="flex items-start gap-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="z. B. Frühstück ca. 11 Uhr Toast mit Käse, Mittag ca. 13 Uhr Nudeln mit Pilzsoße, Abendbrot ca. 20 Uhr …"
                autoFocus
                rows={6}
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
              />
              <div className="flex flex-col gap-2">
                <VoiceRecorder
                  onTranscribed={(text) => setRawText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Screenshots hochladen"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text"
                >
                  <Camera size={20} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addImages(e.target.files)}
                />
              </div>
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
                    <span className="max-w-[8rem] truncate text-xs text-text-secondary">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Entfernen"
                      className="text-text-tertiary"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-text-tertiary">Zeiten werden automatisch erkannt und können danach bearbeitet werden.</p>
            {error && <p className="text-sm text-warning">{error}</p>}

            <button
              type="button"
              disabled={(!rawText.trim() && images.length === 0) || analyzing}
              onClick={handleAnalyze}
              className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
            >
              {analyzing ? 'Wird ausgewertet …' : 'Auswerten'}
            </button>
          </>
        ) : (
          <>
            {drafts.length === 0 && <p className="text-sm text-text-tertiary">Keine Mahlzeiten übrig.</p>}
            {drafts.map((draft) => (
              <div key={draft.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {mealTypeKeys.map((key) => (
                      <ToggleChip
                        key={key}
                        label={mealTypeLabels[key]}
                        active={draft.mealType === key}
                        onClick={() => updateDraft(draft.id, { mealType: key })}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.id)}
                    aria-label="Mahlzeit entfernen"
                    className="shrink-0 text-text-tertiary"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3">
                  <DateTimeField value={draft.eatenAt} onChange={(date) => updateDraft(draft.id, { eatenAt: date })} />
                </div>

                <p className="mt-3 text-sm text-text-secondary">{draft.summary}</p>

                {(draft.markers.length > 0 || draft.good_markers.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {draft.markers.map((m) => (
                      <MarkerChip key={m} label={markerLabels[m as keyof typeof markerLabels]} tone="warning" onInfo={() => {}} />
                    ))}
                    {draft.good_markers.map((m) => (
                      <MarkerChip key={m} label={goodMarkerLabels[m as keyof typeof goodMarkerLabels]} tone="primary" onInfo={() => {}} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDrafts(null)}
                className="rounded-full border border-border px-4 py-3 font-medium text-text-secondary"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={drafts.length === 0 || saving}
                onClick={handleSaveAll}
                className="flex-1 rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
              >
                {saving ? 'Speichern …' : `${drafts.length} ${drafts.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'} speichern`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
