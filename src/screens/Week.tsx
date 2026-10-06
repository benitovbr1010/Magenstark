import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ExportSheet } from '../components/ExportSheet'
import { ReportSheet } from '../components/ReportSheet'
import { ToggleChip } from '../components/ToggleChip'
import { useAuth } from '../lib/AuthContext'
import { DEFAULT_COMPLAINT_THRESHOLDS, isSignificantBowel, isSignificantWellbeing, type ComplaintThresholds } from '../lib/complaints'
import { goodMarkerLabels, markerLabels, mealTypeLabels } from '../lib/constants'
import type { Database } from '../lib/database.types'
import { endOfDay, formatGermanTime, getWeekDates, startOfDay, toDateOnly } from '../lib/datetime'
import { fetchProfile } from '../lib/profile'
import { supabase } from '../lib/supabaseClient'
import { fetchPeriodInsights, fetchWeekInsights, fetchWeekInsightsStats, PERIOD_MIN_CASES, type PeriodInsights } from '../lib/weekInsights'
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

function formatMomentDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${formatGermanTime(d)}`
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
  const [insights, setInsights] = useState<{ auffaellig: string[]; ideas: string[] } | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [periodDays, setPeriodDays] = useState<number | null>(THIS_WEEK)
  const [periodInsights, setPeriodInsights] = useState<PeriodInsights | null>(null)
  const [periodLoading, setPeriodLoading] = useState(true)
  const [thresholds, setThresholds] = useState<ComplaintThresholds>(DEFAULT_COMPLAINT_THRESHOLDS)
  const [showNoClearDifference, setShowNoClearDifference] = useState(false)

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
    fetchProfile(session.user.id).then((profile) => {
      setThresholds({
        symptomMin: profile?.complaint_symptom_min ?? DEFAULT_COMPLAINT_THRESHOLDS.symptomMin,
        bristolMin: profile?.complaint_bristol_min ?? DEFAULT_COMPLAINT_THRESHOLDS.bristolMin,
        urgencyMin: DEFAULT_COMPLAINT_THRESHOLDS.urgencyMin,
        windowHours: profile?.complaint_window_hours ?? DEFAULT_COMPLAINT_THRESHOLDS.windowHours,
      })
    })
  }, [session])

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
    fetchPeriodInsights(session.user.id, windowDays, thresholds).then((result) => {
      if (cancelled) return
      setPeriodInsights(result)
      setPeriodLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [session, periodDays, thresholds])

  const bristolCounts = bristolValues.map((value) => bowelRows.filter((row) => row.bristol === value).length)
  const maxBristolCount = Math.max(1, ...bristolCounts)
  const bowelDaysWithData = new Set(bowelRows.map((r) => toDateOnly(new Date(r.occurred_at)))).size

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

  // Nach Ort: Ort-Snapshot der Einträge je Tag, Beschwerdetage = Tage mit mind. einer signifikanten Beschwerde.
  const placeStats = new Map<string, { total: number; symptomDays: number }>()
  for (const day of days) {
    const dateStr = toDateOnly(day)
    const dayBowel = bowelRows.filter((row) => toDateOnly(new Date(row.occurred_at)) === dateStr)
    const dayWellbeing = wellbeingRows.filter((row) => toDateOnly(new Date(row.occurred_at)) === dateStr)
    const place = dayBowel.find((r) => r.place)?.place ?? dayWellbeing.find((r) => r.place)?.place ?? null
    if (!place) continue
    const hasSymptom = dayBowel.some((r) => isSignificantBowel(r, thresholds)) || dayWellbeing.some((r) => isSignificantWellbeing(r, thresholds))
    const stats = placeStats.get(place) ?? { total: 0, symptomDays: 0 }
    stats.total += 1
    if (hasSymptom) stats.symptomDays += 1
    placeStats.set(place, stats)
  }
  const placeEntries = Array.from(placeStats.entries()).sort((a, b) => b[1].total - a[1].total)

  const hasWellbeingData = (periodInsights?.wellbeing.series.length ?? 0) > 0
  const hasWaterData = periodInsights != null && (periodInsights.water.avgMlPerDay > 0 || periodInsights.water.avgGlassesPerDay > 0)
  const hasMealRhythmData = periodInsights != null && periodInsights.mealRhythm.byMealType.some((m) => m.count > 0)
  const hasSleepData = periodInsights != null && (periodInsights.sleep.avgDurationHours !== null || periodInsights.sleep.avgQuality !== null)
  const hasConnections =
    periodInsights != null &&
    (periodInsights.markerConnections.length > 0 || periodInsights.otherConnections.length > 0 || periodInsights.markerCoOccurrences.length > 0)
  const hasWorstMoments = (periodInsights?.worstMoments.length ?? 0) > 0

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

      <div className="mt-4 flex flex-wrap gap-2">
        {periodOptions.map((opt) => (
          <ToggleChip
            key={opt.label}
            label={opt.label}
            active={periodDays === opt.days}
            onClick={() => setPeriodDays(opt.days)}
          />
        ))}
      </div>

      {loading ? null : (
        <div className="mt-6 flex flex-col gap-4">
          {!periodLoading && hasWorstMoments && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-warning">Schlimmste Momente</p>
              <p className="mt-1 text-xs text-text-tertiary">Die stärksten Beschwerden im gewählten Zeitraum.</p>
              <div className="mt-3 flex flex-col gap-3">
                {periodInsights!.worstMoments.map((m) => (
                  <div key={m.id} className="rounded-xl bg-background p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">{m.label}</span>
                      <span className="text-xs text-text-tertiary">{formatMomentDateTime(m.time)}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Stärke {m.severity}/10{m.place ? ` · ${m.place}` : ''}
                      {m.stress != null ? ` · Stress ${m.stress}/5` : ''}
                      {m.sleepQuality != null ? ` · Schlaf ${m.sleepQuality}/5` : ''}
                    </p>
                    {m.precedingMeals.length > 0 ? (
                      <p className="mt-1 text-xs text-text-tertiary">
                        Davor gegessen:{' '}
                        {m.precedingMeals
                          .map((pm) => `${mealTypeLabels[pm.mealType as keyof typeof mealTypeLabels] ?? pm.mealType}${pm.mainFoods.length ? ` (${pm.mainFoods.join(', ')})` : ''}`)
                          .join(' · ')}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-text-tertiary">Keine Mahlzeit in den {thresholds.windowHours}h davor erfasst.</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                {periodInsights!.worstMomentsSummaryInsufficientData ? (
                  <p className="text-xs text-text-tertiary">
                    Noch zu wenige erfasste Mahlzeiten in diesem Zeitraum, um einen Zusammenhang mit dem Essen zu prüfen.
                  </p>
                ) : periodInsights!.worstMomentsSummary.length > 0 ? (
                  periodInsights!.worstMomentsSummary.map((s) => (
                    <p key={s.label} className="text-xs text-text-secondary">
                      {s.label}: vor {s.nearRatePercent}% der schlimmen Momente, sonst in {s.overallSharePercent}% aller
                      Mahlzeiten – auffällig häufiger.
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-text-tertiary">
                    Keine Zutat sticht bei diesen Momenten besonders heraus – kommt unabhängig vom Essen ähnlich oft vor.
                  </p>
                )}
                {periodInsights!.worstMomentsBaselineNote && (
                  <p className="mt-1 text-xs text-text-tertiary">{periodInsights!.worstMomentsBaselineNote}</p>
                )}
              </div>
            </div>
          )}

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
            {bowelRows.length > 0 && <p className="mt-2 text-xs text-text-tertiary">Basierend auf {bowelDaysWithData} Tagen</p>}
          </div>

          {(periodLoading || hasWellbeingData) && (
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
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold text-text">
                    {periodInsights!.wellbeing.avgMood != null ? `${periodInsights!.wellbeing.avgMood} / 5` : '–'}
                  </p>
                  <svg viewBox="0 0 280 80" className="mt-2 h-20 w-full">
                    <polyline
                      fill="none"
                      stroke="#A9BBAE"
                      strokeWidth="2"
                      points={periodInsights!.wellbeing.series
                        .map((d, i, arr) =>
                          d.avgMood == null ? null : `${(i / Math.max(1, arr.length - 1)) * 280},${76 - (d.avgMood / 5) * 72}`,
                        )
                        .filter((p): p is string => p !== null)
                        .join(' ')}
                    />
                    {periodInsights!.wellbeing.series.map((d, i, arr) =>
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
                  <p className="mt-2 text-xs text-text-tertiary">Basierend auf {periodInsights!.daysWithData} Tagen</p>
                </>
              )}
            </div>
          )}

          {(periodLoading || hasWaterData) && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Trinken</p>
              {periodLoading ? (
                <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold text-text">{formatLiters(periodInsights!.water.avgMlPerDay)}</p>
                  <p className="text-xs text-text-tertiary">
                    Ø pro Tag · {periodInsights!.water.avgGlassesPerDay.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Gläser
                  </p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {periodInsights!.water.avgWakeToFirstGlassMinutes !== null && (
                      <p className="text-sm text-text-secondary">
                        Aufwachen bis erstes Glas: Ø {periodInsights!.water.avgWakeToFirstGlassMinutes} Min. (n=
                        {periodInsights!.water.wakeToFirstGlassCases})
                      </p>
                    )}
                    {periodInsights!.water.firstGlassBeforeFirstMealPercent !== null && (
                      <p className="text-sm text-text-secondary">
                        An {periodInsights!.water.firstGlassBeforeFirstMealPercent}% der Tage zuerst getrunken, dann
                        gegessen (n={periodInsights!.water.firstGlassBeforeFirstMealCases})
                      </p>
                    )}
                    {periodInsights!.water.timeOfDayDistribution.length > 0 && (
                      <p className="text-sm text-text-secondary">
                        {periodInsights!.water.timeOfDayDistribution.map((b) => `${b.label}: ${b.percent}%`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-text-tertiary">Basierend auf {periodInsights!.daysWithData} Tagen</p>
                </>
              )}
            </div>
          )}

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

          {(periodLoading || hasMealRhythmData) && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Essensrhythmus</p>
              {periodLoading ? (
                <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {periodInsights!.mealRhythm.byMealType
                    .filter((m) => m.count > 0)
                    .map((m) => (
                      <p key={m.mealType} className="text-sm text-text">
                        {m.label}: {m.earliest}–{m.latest} Uhr
                        {m.regularity ? ` (${m.regularity})` : ''}
                        {m.skippedDays > 0 ? `, ${m.skippedDays}× ausgelassen` : ''}
                      </p>
                    ))}
                  {periodInsights!.mealRhythm.longestGapHours !== null && (
                    <p className="text-sm text-text-secondary">
                      Längste Pause zwischen Mahlzeiten: {periodInsights!.mealRhythm.longestGapHours} Std.
                    </p>
                  )}
                  {periodInsights!.mealRhythm.avgLastMealToBedtimeMinutes !== null && (
                    <p className="text-sm text-text-secondary">
                      Letzte Mahlzeit bis Schlafengehen: Ø{' '}
                      {Math.round((periodInsights!.mealRhythm.avgLastMealToBedtimeMinutes / 60) * 10) / 10} Std. (n=
                      {periodInsights!.mealRhythm.lastMealToBedtimeCases})
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-tertiary">Basierend auf {periodInsights!.daysWithData} Tagen</p>
                </div>
              )}
            </div>
          )}

          {(periodLoading || hasSleepData) && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-text-tertiary">Schlaf</p>
              {periodLoading ? (
                <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-sm text-text">
                    Ø Dauer:{' '}
                    {periodInsights!.sleep.avgDurationHours !== null
                      ? `${periodInsights!.sleep.avgDurationHours} Std. (n=${periodInsights!.sleep.durationCases})`
                      : 'noch keine Schlafenszeiten erfasst'}
                  </p>
                  <p className="text-sm text-text">
                    Ø Qualität:{' '}
                    {periodInsights!.sleep.avgQuality !== null
                      ? `${periodInsights!.sleep.avgQuality} / 5 (n=${periodInsights!.sleep.qualityCases})`
                      : '–'}
                  </p>
                  {periodInsights!.lateEating && (
                    <p className="text-sm text-text-secondary">
                      Spät gegessen (&lt;2h vor dem Schlafen): Ø Schlafqualität {periodInsights!.lateEating.avgQualityLate}{' '}
                      (n={periodInsights!.lateEating.lateCases}) · sonst Ø {periodInsights!.lateEating.avgQualityNotLate} (n=
                      {periodInsights!.lateEating.notLateCases})
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-tertiary">Basierend auf {periodInsights!.daysWithData} Tagen</p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-tertiary">Mögliche Zusammenhänge</p>
            {periodLoading ? (
              <p className="mt-2 text-sm text-text-tertiary">Wird berechnet …</p>
            ) : !hasConnections ? (
              <p className="mt-2 text-sm text-text-tertiary">Noch zu wenig Daten für Zusammenhänge</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {periodInsights!.markerConnections.map((c) => (
                  <p key={c.markerKey} className="text-sm text-text">
                    {c.label}: Nach {c.withComplaintCount} von {c.withCount} Mahlzeiten mit {c.label} Beschwerden, ohne{' '}
                    {c.label} nach {c.withoutComplaintCount} von {c.withoutCount}. Könnte zusammenhängen.
                  </p>
                ))}
                {periodInsights!.otherConnections.map((c) => (
                  <p key={c.key} className="text-sm text-text">
                    {c.label}: {c.groupALabel} {c.groupARatePercent}% mit Beschwerden (n={c.groupACount}) · {c.groupBLabel}{' '}
                    {c.groupBRatePercent}% (n={c.groupBCount}). Könnte zusammenhängen.
                  </p>
                ))}
                {periodInsights!.markerCoOccurrences.map((co, i) => (
                  <p key={i} className="text-sm text-text-secondary">
                    {co.labelA} &amp; {co.labelB} kommen meist zusammen vor ({co.jointPercent}%), nicht trennbar.
                  </p>
                ))}
                {periodInsights!.noClearDifferenceMarkers.length > 0 && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => setShowNoClearDifference((v) => !v)}
                      className="text-xs font-medium text-text-tertiary underline"
                    >
                      {showNoClearDifference ? 'Weniger anzeigen' : 'Ohne klaren Unterschied anzeigen'}
                    </button>
                    {showNoClearDifference && (
                      <p className="mt-1 text-xs text-text-tertiary">
                        Ohne klaren Unterschied: {periodInsights!.noClearDifferenceMarkers.join(', ')}
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-text-tertiary">
                  Nur Hinweise mit mind. {PERIOD_MIN_CASES} Fällen je Gruppe und deutlichem Unterschied.
                </p>
              </div>
            )}
          </div>

          {!insightsLoading && insights && insights.ideas.length > 0 && (
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
