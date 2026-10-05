import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ExportSheet } from '../components/ExportSheet'
import { ReportSheet } from '../components/ReportSheet'
import { ToggleChip } from '../components/ToggleChip'
import { useAuth } from '../lib/AuthContext'
import { goodMarkerLabels, markerLabels } from '../lib/constants'
import type { Database } from '../lib/database.types'
import { endOfDay, getWeekDates, startOfDay, toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'
import { fetchPeriodInsights, fetchWeekInsights, fetchWeekInsightsStats, type PeriodInsights } from '../lib/weekInsights'
import { formatLiters } from '../lib/water'

/** Sentinel für „Diese Woche" (Montag der aktuellen Kalenderwoche bis heute), im Unterschied zu den
 * rollierenden Zeitfenstern (z.B. „1 Woche" = letzte 7 Tage). */
const THIS_WEEK = -1

const periodOptions: { label: string; days: number | null }[] = [
  { label: 'Diese Woche', days: THIS_WEEK },
  { label: '1 Woche', days: 7 },
  { label: '2 Wochen', days: 14 },
  { label: '4 Wochen', days: 28 },
  { label: 'Alles', days: null },
]

type BowelRow = Database['public']['Tables']['bowel_movements']['Row']
type WellbeingRow = Database['public']['Tables']['wellbeing']['Row']
type MealRow = Database['public']['Tables']['meals']['Row']
type MarkerKey = keyof typeof markerLabels
type GoodMarkerKey = keyof typeof goodMarkerLabels

const bristolValues = [1, 2, 3, 4, 5, 6, 7] as const
const moodColors = ['#E6E9E7', '#C9D2CB', '#A9BBAE', '#8CA791', '#6F8A74']

function formatWeekRange(days: Date[]): string {
  const first = days[0]
  const last = days[6]
  const firstMonth = first.toLocaleDateString('de-DE', { month: 'long' })
  const lastMonth = last.toLocaleDateString('de-DE', { month: 'long' })
  return firstMonth === lastMonth
    ? `${first.getDate()}. – ${last.getDate()}. ${lastMonth}`
    : `${first.getDate()}. ${firstMonth} – ${last.getDate()}. ${lastMonth}`
}

function hasBowelSymptom(row: BowelRow): boolean {
  return row.pain || row.urgency > 0 || row.incomplete || row.mucus || row.blood
}

function hasWellbeingSymptom(row: WellbeingRow): boolean {
  return (
    row.abdominal_pain > 0 ||
    row.bloating > 0 ||
    row.nausea > 0 ||
    row.fullness > 0 ||
    row.urgency > 0 ||
    row.stress > 0 ||
    row.rumbling > 0 ||
    row.heartburn > 0
  )
}

export function Week() {
  const { session } = useAuth()
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [bowelRows, setBowelRows] = useState<BowelRow[]>([])
  const [wellbeingRows, setWellbeingRows] = useState<WellbeingRow[]>([])
  const [mealRows, setMealRows] = useState<MealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [enoughDataForInsights, setEnoughDataForInsights] = useState<boolean | null>(null)
  const [insights, setInsights] = useState<{ auffaellig: string[]; ideas: string[] } | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [periodDays, setPeriodDays] = useState<number | null>(28)
  const [periodInsights, setPeriodInsights] = useState<PeriodInsights | null>(null)
  const [periodLoading, setPeriodLoading] = useState(true)

  const days = useMemo(() => getWeekDates(referenceDate), [referenceDate])

  function shiftWeek(deltaDays: number) {
    setReferenceDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + deltaDays)
      return next
    })
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    setLoading(true)

    const from = startOfDay(days[0]).toISOString()
    const to = endOfDay(days[6]).toISOString()

    Promise.all([
      supabase
        .from('bowel_movements')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('occurred_at', from)
        .lte('occurred_at', to),
      supabase
        .from('wellbeing')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('occurred_at', from)
        .lte('occurred_at', to),
      supabase.from('meals').select('*').eq('user_id', session.user.id).gte('eaten_at', from).lte('eaten_at', to),
    ]).then(([bowelRes, wellbeingRes, mealsRes]) => {
      if (cancelled) return
      setBowelRows(bowelRes.data ?? [])
      setWellbeingRows(wellbeingRes.data ?? [])
      setMealRows(mealsRes.data ?? [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [session, days])

  useEffect(() => {
    if (!session) return
    let cancelled = false

    fetchWeekInsightsStats(session.user.id).then((stats) => {
      if (cancelled) return
      setEnoughDataForInsights(stats !== null)
      if (!stats) return
      setInsightsLoading(true)
      fetchWeekInsights(stats).then((result) => {
        if (cancelled) return
        setInsights(result)
        setInsightsLoading(false)
      })
    })

    return () => {
      cancelled = true
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    setPeriodLoading(true)

    const windowDays =
      periodDays === THIS_WEEK
        ? getWeekDates(new Date()).findIndex((d) => toDateOnly(d) === toDateOnly(new Date())) + 1
        : periodDays
    fetchPeriodInsights(session.user.id, windowDays).then((result) => {
      if (cancelled) return
      setPeriodInsights(result)
      setPeriodLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [session, periodDays])

  const bristolCounts = bristolValues.map((value) => bowelRows.filter((row) => row.bristol === value).length)
  const maxBristolCount = Math.max(1, ...bristolCounts)

  const markerCounts = (Object.keys(markerLabels) as MarkerKey[])
    .map((key) => ({ key, count: mealRows.filter((row) => row.markers.includes(key)).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
  const goodMarkerCounts = (Object.keys(goodMarkerLabels) as GoodMarkerKey[])
    .map((key) => ({ key, count: mealRows.filter((row) => row.good_markers.includes(key)).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
  const maxMarkerCount = Math.max(1, ...markerCounts.map((e) => e.count), ...goodMarkerCounts.map((e) => e.count))

  const foodCounts = new Map<string, number>()
  for (const meal of mealRows) {
    for (const food of meal.main_foods) {
      foodCounts.set(food, (foodCounts.get(food) ?? 0) + 1)
    }
  }
  const topFoods = Array.from(foodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  // Nach Ort: Ort-Snapshot der Einträge je Tag, Beschwerdetage = Tage mit mind. einem Flag/Symptom
  const placeStats = new Map<string, { total: number; symptomDays: number }>()
  for (const day of days) {
    const dateStr = toDateOnly(day)
    const dayBowel = bowelRows.filter((row) => toDateOnly(new Date(row.occurred_at)) === dateStr)
    const dayWellbeing = wellbeingRows.filter((row) => toDateOnly(new Date(row.occurred_at)) === dateStr)
    const place = dayBowel.find((r) => r.place)?.place ?? dayWellbeing.find((r) => r.place)?.place ?? null
    if (!place) continue
    const hasSymptom = dayBowel.some(hasBowelSymptom) || dayWellbeing.some(hasWellbeingSymptom)
    const stats = placeStats.get(place) ?? { total: 0, symptomDays: 0 }
    stats.total += 1
    if (hasSymptom) stats.symptomDays += 1
    placeStats.set(place, stats)
  }
  const placeEntries = Array.from(placeStats.entries()).sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="px-4 pt-6 pb-10">
      <h1 className="text-2xl font-semibold text-text">Woche</h1>
      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={() => shiftWeek(-7)} aria-label="Vorherige Woche">
          <ChevronLeft size={18} className="text-text-secondary" />
        </button>
        <p className="text-sm text-text-secondary">{formatWeekRange(days)}</p>
        <button type="button" onClick={() => shiftWeek(7)} aria-label="Nächste Woche">
          <ChevronRight size={18} className="text-text-secondary" />
        </button>
      </div>

      {loading ? null : (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-tertiary">Toilette</p>
            <p className="mt-1 text-2xl font-semibold text-text">{bowelRows.length}×</p>
            <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 56 }}>
              {bristolCounts.map((count, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-md bg-primary"
                    style={{ height: `${Math.max(4, (count / maxBristolCount) * 48)}px` }}
                  />
                  <span className="text-xs text-text-tertiary">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {periodOptions.map((opt) => (
              <ToggleChip
                key={opt.label}
                label={opt.label}
                active={periodDays === opt.days}
                onClick={() => setPeriodDays(opt.days)}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-tertiary">Befinden</p>
              <div className="text-right text-xs leading-tight text-text-tertiary">
                <p>gut</p>
                <p>schlecht</p>
              </div>
            </div>
            {periodLoading ? (
              <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
            ) : !periodInsights || periodInsights.wellbeing.series.length === 0 ? (
              <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Muster</p>
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-text">
                  {periodInsights.wellbeing.avgMood != null ? `${periodInsights.wellbeing.avgMood} / 5` : '–'}
                </p>
                <svg viewBox="0 0 280 80" className="mt-2 h-20 w-full">
                  <polyline
                    fill="none"
                    stroke="#A9BBAE"
                    strokeWidth="2"
                    points={periodInsights.wellbeing.series
                      .map((d, i, arr) =>
                        d.avgMood == null ? null : `${(i / Math.max(1, arr.length - 1)) * 280},${76 - (d.avgMood / 5) * 72}`,
                      )
                      .filter((p): p is string => p !== null)
                      .join(' ')}
                  />
                  {periodInsights.wellbeing.series.map((d, i, arr) =>
                    d.avgMood == null ? null : (
                      <circle
                        key={d.date}
                        cx={(i / Math.max(1, arr.length - 1)) * 280}
                        cy={76 - (d.avgMood / 5) * 72}
                        r={3}
                        fill={d.isStressDay ? '#A8483E' : moodColors[Math.max(0, Math.round(d.avgMood) - 1)]}
                      />
                    ),
                  )}
                </svg>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-tertiary">Trinken</p>
            {periodLoading ? (
              <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
            ) : !periodInsights ? (
              <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Muster</p>
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-text">{formatLiters(periodInsights.water.avgMlPerDay)}</p>
                <p className="text-xs text-text-tertiary">
                  Ø pro Tag · {periodInsights.water.avgGlassesPerDay.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Gläser
                </p>
              </>
            )}
          </div>

          {markerCounts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-warning">Mögliche Auslöser</p>
              <div className="mt-3 flex flex-col gap-2">
                {markerCounts.map(({ key, count }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-xs text-text-secondary">{markerLabels[key]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-warning"
                        style={{ width: `${(count / maxMarkerCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right text-xs text-text-tertiary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {goodMarkerCounts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-primary-text">Gut für dich</p>
              <div className="mt-3 flex flex-col gap-2">
                {goodMarkerCounts.map(({ key, count }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-xs text-text-secondary">{goodMarkerLabels[key]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(count / maxMarkerCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right text-xs text-text-tertiary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topFoods.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Am häufigsten gegessen</p>
              <div className="mt-3 flex flex-col gap-2">
                {topFoods.map(([food, count]) => (
                  <div key={food} className="flex items-center justify-between text-sm">
                    <span className="text-text">{food}</span>
                    <span className="text-text-tertiary">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {placeEntries.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Nach Ort</p>
              <div className="mt-3 flex flex-col gap-2">
                {placeEntries.map(([place, stats]) => (
                  <p key={place} className="text-sm text-text">
                    {place}: {stats.symptomDays} von {stats.total} {stats.total === 1 ? 'Tag' : 'Tagen'} mit
                    Beschwerden
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-tertiary">Essensrhythmus</p>
            {periodLoading ? (
              <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
            ) : !periodInsights ? (
              <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Muster</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {periodInsights.mealRhythm.byMealType
                  .filter((m) => m.count > 0)
                  .map((m) => (
                    <p key={m.mealType} className="text-sm text-text">
                      {m.label}: {m.earliest}–{m.latest} Uhr
                      {m.regularity ? ` (${m.regularity})` : ''}
                      {m.skippedDays > 0 ? `, ${m.skippedDays}× ausgelassen` : ''}
                    </p>
                  ))}
                {periodInsights.mealRhythm.longestGapHours !== null && (
                  <p className="text-sm text-text-secondary">
                    Längste Pause zwischen Mahlzeiten: {periodInsights.mealRhythm.longestGapHours} Std.
                  </p>
                )}
                {periodInsights.mealRhythm.avgLastMealToBedtimeMinutes !== null && (
                  <p className="text-sm text-text-secondary">
                    Letzte Mahlzeit bis Schlafengehen: Ø{' '}
                    {Math.round((periodInsights.mealRhythm.avgLastMealToBedtimeMinutes / 60) * 10) / 10} Std. (n=
                    {periodInsights.mealRhythm.lastMealToBedtimeCases})
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-tertiary">Schlaf</p>
            {periodLoading ? (
              <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
            ) : !periodInsights ? (
              <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Muster</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-sm text-text">
                  Ø Dauer:{' '}
                  {periodInsights.sleep.avgDurationHours !== null
                    ? `${periodInsights.sleep.avgDurationHours} Std. (n=${periodInsights.sleep.durationCases})`
                    : 'noch keine Schlafenszeiten erfasst'}
                </p>
                <p className="text-sm text-text">
                  Ø Qualität:{' '}
                  {periodInsights.sleep.avgQuality !== null
                    ? `${periodInsights.sleep.avgQuality} / 5 (n=${periodInsights.sleep.qualityCases})`
                    : '–'}
                </p>
                {periodInsights.lateEating ? (
                  <p className="text-sm text-text-secondary">
                    Spät gegessen (&lt;2h vor dem Schlafen): Ø Schlafqualität {periodInsights.lateEating.avgQualityLate}{' '}
                    (n={periodInsights.lateEating.lateCases}) · sonst Ø {periodInsights.lateEating.avgQualityNotLate} (n=
                    {periodInsights.lateEating.notLateCases})
                  </p>
                ) : (
                  <p className="text-xs text-text-tertiary">Noch zu wenig Daten für Vergleich mit spätem Essen</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-tertiary">Mögliche Zusammenhänge</p>
            {periodLoading ? (
              <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
            ) : !periodInsights || periodInsights.connections.length === 0 ? (
              <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Vergleiche</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {periodInsights.connections.map((c, i) =>
                  c.type === 'ratio' ? (
                    <p key={i} className="text-sm text-text">
                      {c.label}: Bei {c.withSymptomCount} von {c.withCount} Mahlzeiten mit {c.label} traten danach
                      Beschwerden auf, ohne {c.label} bei {c.withoutSymptomCount} von {c.withoutCount}. Könnte
                      zusammenhängen.
                    </p>
                  ) : (
                    <p key={i} className="text-sm text-text">
                      {c.label}: {c.groupALabel} Ø {c.groupAAvg} (n={c.groupACount}) · {c.groupBLabel} Ø {c.groupBAvg}{' '}
                      (n={c.groupBCount}) – {c.unit}. Könnte zusammenhängen.
                    </p>
                  ),
                )}
              </div>
            )}
          </div>

          {enoughDataForInsights !== null && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Auffällig</p>
              {!enoughDataForInsights ? (
                <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Muster</p>
              ) : insightsLoading ? (
                <p className="mt-2 text-sm text-text-tertiary">Wird analysiert …</p>
              ) : insights && insights.auffaellig.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {insights.auffaellig.map((hint, i) => (
                    <li key={i} className="text-sm text-text">
                      · {hint}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-text-tertiary">Keine auffälligen Muster erkannt.</p>
              )}
            </div>
          )}

          {enoughDataForInsights && !insightsLoading && insights && insights.ideas.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Idee für nächste Woche</p>
              <ul className="mt-2 flex flex-col gap-1">
                {insights.ideas.map((idea, i) => (
                  <li key={i} className="text-sm text-text">
                    · {idea}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bowelRows.length === 0 && wellbeingRows.length === 0 && mealRows.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-text-tertiary">Noch keine Einträge in dieser Woche.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="rounded-full border border-border bg-card px-4 py-3 text-center font-medium text-text"
          >
            Arztbericht als PDF
          </button>

          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="rounded-full border border-border bg-card px-4 py-3 text-center font-medium text-text"
          >
            Ernährungstagebuch exportieren
          </button>
        </div>
      )}

      {session && (
        <>
          <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} userId={session.user.id} />
          <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} userId={session.user.id} />
        </>
      )}
    </div>
  )
}
