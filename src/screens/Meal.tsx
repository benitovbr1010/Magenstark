import { Info, Soup } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DateTimeField } from '../components/DateTimeField'
import { KnowledgeSheet } from '../components/KnowledgeSheet'
import { MarkerChip } from '../components/MarkerChip'
import { MarkerOrigins } from '../components/MarkerOrigins'
import { ScreenHeader } from '../components/ScreenHeader'
import { SavedMealSheet, type SavedMealDraft } from '../components/SavedMealSheet'
import { Switch } from '../components/Switch'
import { ToggleChip } from '../components/ToggleChip'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { useAuth } from '../lib/AuthContext'
import { goodMarkerLabels, markerLabels, mealTypeLabels, portionLabels, type PortionKey } from '../lib/constants'
import { fetchLatestContext, type ActiveContext } from '../lib/context'
import { withDatePart } from '../lib/datetime'
import { computeMealMarkers, fetchIngredientProfiles, type IngredientProfileRow } from '../lib/ingredientProfiles'
import { goodMarkerArticle, markerArticle, type KnowledgeArticle } from '../lib/knowledge'
import { fetchSavedMeals, type SavedMealRow } from '../lib/savedMeals'
import { supabase } from '../lib/supabaseClient'

type MealType = keyof typeof mealTypeLabels
type Marker = keyof typeof markerLabels
type GoodMarker = keyof typeof goodMarkerLabels

const mealTypeKeys = Object.keys(mealTypeLabels) as MealType[]
const markerKeys = Object.keys(markerLabels) as Marker[]
const goodMarkerKeys = Object.keys(goodMarkerLabels) as GoodMarker[]
const portionKeys = Object.keys(portionLabels) as PortionKey[]

function capChips<T extends string>(items: T[], max = 3): { shown: T[]; extra: number } {
  return { shown: items.slice(0, max), extra: Math.max(0, items.length - max) }
}

export function Meal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const dateParam = searchParams.get('date')
  const { session } = useAuth()

  const [rawText, setRawText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [editingSummary, setEditingSummary] = useState(false)
  const [infoArticle, setInfoArticle] = useState<KnowledgeArticle | null>(null)

  const [eatenAt, setEatenAt] = useState(() => (dateParam ? withDatePart(new Date(), dateParam) : new Date()))
  const [mealType, setMealType] = useState<MealType>('snack')
  const [summary, setSummary] = useState('')
  const [mainFoods, setMainFoods] = useState<string[]>([])
  const [markers, setMarkers] = useState<Marker[]>([])
  const [goodMarkers, setGoodMarkers] = useState<GoodMarker[]>([])
  const [goodFoods, setGoodFoods] = useState<string[]>([])
  const [ingredients, setIngredients] = useState<string[]>([])
  const [prepMarkers, setPrepMarkers] = useState<string[]>([])
  const [fodmapSources, setFodmapSources] = useState<string[]>([])
  const [portion, setPortion] = useState<PortionKey | null>(null)
  const [eatenQuickly, setEatenQuickly] = useState(false)
  const [ingredientProfiles, setIngredientProfiles] = useState<Record<string, IngredientProfileRow>>({})

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!editId)
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null)

  const [savedMeals, setSavedMeals] = useState<SavedMealRow[]>([])
  const [saveMealSheetOpen, setSaveMealSheetOpen] = useState(false)

  useEffect(() => {
    if (editId || !session) return
    fetchLatestContext(session.user.id).then(setActiveContext)
  }, [editId, session])

  useEffect(() => {
    if (editId || !session) return
    fetchSavedMeals(session.user.id).then(setSavedMeals)
  }, [editId, session])

  useEffect(() => {
    if (!editId) return
    supabase
      .from('meals')
      .select('*')
      .eq('id', editId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setRawText(data.raw_text)
          setEatenAt(new Date(data.eaten_at))
          setMealType(data.meal_type as MealType)
          setSummary(data.summary)
          setMainFoods(data.main_foods)
          setMarkers(data.markers as Marker[])
          setGoodMarkers(data.good_markers as GoodMarker[])
          setGoodFoods(data.good_foods ?? [])
          setIngredients(data.ingredients ?? [])
          setPrepMarkers(data.prep_markers ?? [])
          setFodmapSources(data.fodmap_sources ?? [])
          setPortion((data.portion as PortionKey | null) ?? null)
          setEatenQuickly(data.eaten_quickly ?? false)
          if (data.ingredients?.length) setIngredientProfiles(await fetchIngredientProfiles(data.ingredients))
          setAnalyzed(true)
        }
        setLoading(false)
      })
  }, [editId])

  function toggleMarker(key: Marker) {
    setMarkers((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function toggleGoodMarker(key: GoodMarker) {
    setGoodMarkers((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  async function runAnalysis(text: string, keepTime: boolean) {
    setAnalyzing(true)
    setAnalyzeError(null)
    const now = new Date()
    const { data, error } = await supabase.functions.invoke('analyze-meal', {
      body: { text, currentTime: now.toISOString() },
    })
    setAnalyzing(false)
    if (error || !data) {
      setAnalyzeError('Auswertung fehlgeschlagen. Bitte erneut versuchen.')
      return
    }
    setMealType(data.meal_type)
    setSummary(data.summary)
    setMainFoods(data.main_foods ?? [])
    setMarkers(data.markers ?? [])
    setGoodMarkers(data.good_markers ?? [])
    setGoodFoods(data.good_foods ?? [])
    setIngredients(data.ingredients ?? [])
    setPrepMarkers(data.prep_markers ?? [])
    setFodmapSources(data.fodmap_sources ?? [])
    if (data.ingredients?.length) setIngredientProfiles(await fetchIngredientProfiles(data.ingredients))
    if (!keepTime) {
      if (data.eaten_at_hint) {
        const [h, m] = data.eaten_at_hint.split(':').map(Number)
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const withHint = new Date(now)
          withHint.setHours(h, m, 0, 0)
          setEatenAt(withHint)
        }
      } else {
        setEatenAt(now)
      }
    }
    setAnalyzed(true)
  }

  async function handleAnalyze() {
    if (!rawText.trim()) return
    await runAnalysis(rawText, false)
  }

  async function handleReanalyze() {
    if (!rawText.trim()) return
    await runAnalysis(rawText, true)
  }

  function applySavedMeal(meal: SavedMealRow) {
    setRawText(meal.name)
    setMealType(meal.meal_type as MealType)
    setSummary(meal.summary)
    setMainFoods(meal.main_foods)
    setMarkers(meal.markers as Marker[])
    setGoodMarkers(meal.good_markers as GoodMarker[])
    setGoodFoods(meal.good_foods)
    setIngredients([])
    setPrepMarkers([])
    setFodmapSources(meal.fodmap_sources ?? [])
    setIngredientProfiles({})
    setAnalyzed(true)
  }

  async function handleSave() {
    if (!session || !summary.trim()) return
    setSaving(true)
    const payload = {
      user_id: session.user.id,
      eaten_at: eatenAt.toISOString(),
      meal_type: mealType,
      raw_text: rawText,
      summary: summary.trim(),
      main_foods: mainFoods,
      markers,
      good_markers: goodMarkers,
      good_foods: goodFoods,
      ingredients,
      prep_markers: prepMarkers,
      fodmap_sources: fodmapSources,
      portion,
      eaten_quickly: eatenQuickly,
      ...(editId ? {} : { place: activeContext?.place ?? null, phase: activeContext?.phase ?? null }),
    }
    const { error } = editId
      ? await supabase.from('meals').update(payload).eq('id', editId)
      : await supabase.from('meals').insert(payload)
    setSaving(false)
    if (!error) {
      navigate('/')
    }
  }

  async function handleDelete() {
    if (!editId) return
    setSaving(true)
    const { error } = await supabase.from('meals').delete().eq('id', editId)
    setSaving(false)
    if (!error) {
      navigate('/')
    }
  }

  if (loading) {
    return null
  }

  const markerChips = capChips(markers)
  const goodChips = capChips(goodMarkers)
  const breakdown = computeMealMarkers(ingredients, prepMarkers, ingredientProfiles)
  const savedMealDraft: SavedMealDraft = {
    summary,
    meal_type: mealType,
    main_foods: mainFoods,
    markers,
    good_markers: goodMarkers,
    good_foods: goodFoods,
    fodmap_sources: fodmapSources,
  }

  return (
    <div className="pb-10">
      <ScreenHeader title="Eintrag erfassen" />

      <div className="mt-4 flex flex-col gap-6 px-4">
        <DateTimeField value={eatenAt} onChange={setEatenAt} />

        {!analyzed ? (
          <>
            {!editId && savedMeals.length > 0 && (
              <div>
                <p className="text-sm font-medium text-text">Meine Mahlzeiten</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {savedMeals.map((meal) => (
                    <button
                      key={meal.id}
                      type="button"
                      onClick={() => applySavedMeal(meal)}
                      className="shrink-0 rounded-2xl border border-border bg-card px-4 py-3 text-left"
                    >
                      <p className="text-sm font-medium text-text">{meal.name}</p>
                      <p className="max-w-[10rem] truncate text-xs text-text-tertiary">{meal.summary}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Was hast du gegessen?"
                autoFocus
                rows={6}
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
              />
              <VoiceRecorder
                onTranscribed={(text) => setRawText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              />
            </div>
            {analyzeError && <p className="text-sm text-warning">{analyzeError}</p>}
            <button
              type="button"
              disabled={!rawText.trim() || analyzing}
              onClick={handleAnalyze}
              className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
            >
              {analyzing ? 'Wird ausgewertet …' : 'Auswerten'}
            </button>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-text-tertiary">Das hast du erzählt</p>
              <p className="mt-1 text-sm text-text">{rawText}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-text-tertiary">Zusammenfassung</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text">
                  <Soup size={18} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-medium text-text">{mealTypeLabels[mealType]}</p>
                  <p className="text-sm text-text-secondary">{summary}</p>
                </div>
              </div>

              {markerChips.shown.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-text-tertiary">Mögliche Auslöser</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {markerChips.shown.map((m) => (
                      <MarkerChip
                        key={m}
                        label={markerLabels[m]}
                        tone="warning"
                        onInfo={() => setInfoArticle(markerArticle(m, markerLabels[m]))}
                      />
                    ))}
                    {markerChips.extra > 0 && (
                      <span className="rounded-full bg-card px-3 py-1 text-xs text-text-tertiary">
                        +{markerChips.extra}
                      </span>
                    )}
                  </div>
                  <MarkerOrigins origins={breakdown.markerOrigins} labels={markerLabels} fodmapTypesByIngredient={breakdown.fodmapTypesByIngredient} tone="warning" />
                </div>
              )}

              {goodChips.shown.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-text-tertiary">Gut für dich</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {goodChips.shown.map((m) => (
                      <MarkerChip
                        key={m}
                        label={goodMarkerLabels[m]}
                        tone="primary"
                        onInfo={() => setInfoArticle(goodMarkerArticle(m, goodMarkerLabels[m]))}
                      />
                    ))}
                    {goodChips.extra > 0 && (
                      <span className="rounded-full bg-card px-3 py-1 text-xs text-text-tertiary">
                        +{goodChips.extra}
                      </span>
                    )}
                  </div>
                  <MarkerOrigins origins={breakdown.goodMarkerOrigins} labels={goodMarkerLabels} tone="primary" />
                  {goodFoods.length > 0 && (
                    <p className="mt-2 text-xs text-text-secondary">Konkret gut: {goodFoods.join(', ')}</p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text">Portion</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {portionKeys.map((key) => (
                  <ToggleChip
                    key={key}
                    label={portionLabels[key]}
                    active={portion === key}
                    onClick={() => setPortion((prev) => (prev === key ? null : key))}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-medium text-text">Schnell gegessen</p>
                <Switch checked={eatenQuickly} onChange={setEatenQuickly} />
              </div>
            </div>

            {editingSummary && (
              <div className="flex flex-col gap-4">
                <div>
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

                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={4}
                  placeholder="Was hast du gegessen?"
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
                />
                <button
                  type="button"
                  disabled={!rawText.trim() || analyzing}
                  onClick={handleReanalyze}
                  className="self-start rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-40"
                >
                  {analyzing ? 'Wird neu ausgewertet …' : 'Neu analysieren'}
                </button>
                {analyzeError && <p className="text-sm text-warning">{analyzeError}</p>}

                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                  className="rounded-2xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
                />

                <div>
                  <p className="text-sm font-medium text-text">Mögliche Auslöser</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {markerKeys.map((key) => (
                      <div key={key} className="flex items-center gap-1">
                        <ToggleChip
                          label={markerLabels[key]}
                          active={markers.includes(key)}
                          onClick={() => toggleMarker(key)}
                          tone="warning"
                        />
                        <button
                          type="button"
                          onClick={() => setInfoArticle(markerArticle(key, markerLabels[key]))}
                          className="text-text-tertiary"
                          aria-label={`Info zu ${markerLabels[key]}`}
                        >
                          <Info size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-text">Gut für dich</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {goodMarkerKeys.map((key) => (
                      <div key={key} className="flex items-center gap-1">
                        <ToggleChip
                          label={goodMarkerLabels[key]}
                          active={goodMarkers.includes(key)}
                          onClick={() => toggleGoodMarker(key)}
                        />
                        <button
                          type="button"
                          onClick={() => setInfoArticle(goodMarkerArticle(key, goodMarkerLabels[key]))}
                          className="text-text-tertiary"
                          aria-label={`Info zu ${goodMarkerLabels[key]}`}
                        >
                          <Info size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!summary.trim() || saving}
              onClick={handleSave}
              className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
            >
              {saving ? 'Speichern …' : editId ? 'Eintrag aktualisieren' : 'Eintrag speichern'}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingSummary((v) => !v)}
                className="text-sm font-medium text-primary-text"
              >
                {editingSummary ? 'Fertig' : 'Bearbeiten'}
              </button>
              <button
                type="button"
                onClick={() => setSaveMealSheetOpen(true)}
                className="text-sm font-medium text-primary-text"
              >
                Als eigene Mahlzeit merken
              </button>
            </div>

            {editId && (
              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                className="text-sm font-medium text-warning"
              >
                Eintrag löschen
              </button>
            )}
          </>
        )}
      </div>

      {session && (
        <SavedMealSheet
          open={saveMealSheetOpen}
          onClose={() => setSaveMealSheetOpen(false)}
          userId={session.user.id}
          draft={savedMealDraft}
          onSaved={() => fetchSavedMeals(session.user.id).then(setSavedMeals)}
        />
      )}

      <KnowledgeSheet article={infoArticle} onClose={() => setInfoArticle(null)} />
    </div>
  )
}
