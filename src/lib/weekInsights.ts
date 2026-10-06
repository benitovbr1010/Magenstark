import {
  bowelSeverity,
  collectComplaintEvents,
  COMPLAINT_WINDOW_START_HOURS,
  isSignificantBowel,
  isSignificantWellbeing,
  wellbeingSeverity,
  type ComplaintThresholds,
} from './complaints'
import { dayTagLabels, flagLabels, markerLabels, symptomLabels } from './constants'
import type { Database } from './database.types'
import { addDays, toDateOnly } from './datetime'
import { computeMealRhythm, computeSleepDuration, groupMealsByDay, minutesOfDay, type MealRhythmStats, type SleepDurationStats } from './mealRhythm'
import { fetchSleepLogs } from './sleep'
import { supabase } from './supabaseClient'
import { fetchWaterLogs, totalMl } from './water'

type BowelRow = Database['public']['Tables']['bowel_movements']['Row']
type WellbeingRow = Database['public']['Tables']['wellbeing']['Row']
type MealRow = Database['public']['Tables']['meals']['Row']
type DayClosingRow = Database['public']['Tables']['day_closings']['Row']
type MarkerKey = keyof typeof markerLabels
type DayTagKey = keyof typeof dayTagLabels
type FlagKey = keyof typeof flagLabels

const symptomKeys = Object.keys(symptomLabels) as (keyof typeof symptomLabels)[]
const flagKeys = Object.keys(flagLabels) as FlagKey[]
const markerKeys = Object.keys(markerLabels) as MarkerKey[]

const WINDOW_DAYS = 42
const MIN_DAYS_WITH_DATA = 21
const MIN_GROUP_SIZE = 3
/** Mindestanzahl Fälle je Vergleichsgruppe für die "Mögliche Zusammenhänge"-Karte. */
export const PERIOD_MIN_CASES = 5
/** Mindestunterschied in Prozentpunkten, ab dem ein Zusammenhang als "echter Unterschied" angezeigt wird. */
export const MIN_DIFF_PERCENT_POINTS = 20
/** Ab diesem Anteil gemeinsamen Vorkommens gelten zwei Marker als nicht trennbar. */
const CO_OCCURRENCE_THRESHOLD_PERCENT = 70

export type WeekInsightsStats = {
  daysWithData: number
  symptomWeeklyAverages: number[]
  bristolAverage: number | null
  flagRates: { label: string; percent: number }[]
  markerCorrelations: { label: string; daysWithMarker: number; avgSymptomWithMarker: number; avgSymptomWithoutMarker: number }[]
  placeSymptomRates: { place: string; days: number; symptomDays: number }[]
  dayTagStress: { label: string; count: number; avgStressWithTag: number; avgStressWithoutTag: number }[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Nur für die "Idee für nächste Woche"-KI-Anfrage: grobes Tages-Symptomlevel (0–10) über alle Werte,
 * dient nur als Eingabe-Signal, nicht als angezeigter Wert. */
function dailySymptomScore(rows: WellbeingRow[]): number | null {
  if (rows.length === 0) return null
  const sum = rows.reduce((s, r) => s + symptomKeys.reduce((acc, key) => acc + r[key], 0), 0)
  return sum / rows.length / symptomKeys.length
}

export async function fetchWeekInsightsStats(userId: string): Promise<WeekInsightsStats | null> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - (WINDOW_DAYS - 1))
  from.setHours(0, 0, 0, 0)

  const [bowelRes, wellbeingRes, mealsRes, dayClosingsRes] = await Promise.all([
    supabase.from('bowel_movements').select('*').eq('user_id', userId).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    supabase.from('wellbeing').select('*').eq('user_id', userId).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    supabase.from('meals').select('*').eq('user_id', userId).gte('eaten_at', from.toISOString()).lte('eaten_at', to.toISOString()),
    supabase.from('day_closings').select('*').eq('user_id', userId).gte('date', toDateOnly(from)).lte('date', toDateOnly(to)),
  ])

  const bowelRows = bowelRes.data ?? []
  const wellbeingRows = wellbeingRes.data ?? []
  const mealRows = mealsRes.data ?? []
  const dayClosingRows = dayClosingsRes.data ?? []

  const daysWithData = new Set<string>()
  for (const r of bowelRows) daysWithData.add(toDateOnly(new Date(r.occurred_at)))
  for (const r of wellbeingRows) daysWithData.add(toDateOnly(new Date(r.occurred_at)))
  for (const r of mealRows) daysWithData.add(toDateOnly(new Date(r.eaten_at)))
  for (const r of dayClosingRows) daysWithData.add(r.date)

  if (daysWithData.size < MIN_DAYS_WITH_DATA) return null

  const symptomWeeklyAverages: number[] = []
  for (let w = 0; w < 6; w++) {
    const weekStart = new Date(from)
    weekStart.setDate(weekStart.getDate() + w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    const weekWellbeing = wellbeingRows.filter((r) => {
      const d = new Date(r.occurred_at)
      return d >= weekStart && d <= weekEnd
    })
    const score = dailySymptomScore(weekWellbeing)
    if (score !== null) symptomWeeklyAverages.push(round1(score))
  }

  const bristolAverage = bowelRows.length ? round1(bowelRows.reduce((s, r) => s + r.bristol, 0) / bowelRows.length) : null

  const flagRates = bowelRows.length
    ? [
        ...flagKeys.map((key) => ({
          label: flagLabels[key],
          percent: Math.round((bowelRows.filter((r) => Boolean(r[key])).length / bowelRows.length) * 100),
        })),
        { label: 'Dringend', percent: Math.round((bowelRows.filter((r) => r.urgency > 0).length / bowelRows.length) * 100) },
      ].filter((f) => f.percent > 0)
    : []

  const symptomByDay = new Map<string, number>()
  const dayMap = new Map<string, WellbeingRow[]>()
  for (const r of wellbeingRows) {
    const day = toDateOnly(new Date(r.occurred_at))
    const arr = dayMap.get(day) ?? []
    arr.push(r)
    dayMap.set(day, arr)
  }
  for (const [day, rows] of dayMap) {
    const score = dailySymptomScore(rows)
    if (score !== null) symptomByDay.set(day, score)
  }

  const markerCorrelations = (Object.keys(markerLabels) as MarkerKey[])
    .map((key) => {
      const daysWithMarker = new Set(mealRows.filter((m) => m.markers.includes(key)).map((m) => toDateOnly(new Date(m.eaten_at))))
      const withScores: number[] = []
      const withoutScores: number[] = []
      for (const [day, score] of symptomByDay) {
        if (daysWithMarker.has(day)) withScores.push(score)
        else withoutScores.push(score)
      }
      if (withScores.length < MIN_GROUP_SIZE || withoutScores.length < MIN_GROUP_SIZE) return null
      return {
        label: markerLabels[key],
        daysWithMarker: withScores.length,
        avgSymptomWithMarker: round1(withScores.reduce((a, b) => a + b, 0) / withScores.length),
        avgSymptomWithoutMarker: round1(withoutScores.reduce((a, b) => a + b, 0) / withoutScores.length),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  const placeStats = new Map<string, { total: number; symptomDays: number }>()
  const allDays = new Set([
    ...bowelRows.map((r) => toDateOnly(new Date(r.occurred_at))),
    ...wellbeingRows.map((r) => toDateOnly(new Date(r.occurred_at))),
  ])
  for (const day of allDays) {
    const dayBowel = bowelRows.filter((r) => toDateOnly(new Date(r.occurred_at)) === day)
    const dayWellbeing = wellbeingRows.filter((r) => toDateOnly(new Date(r.occurred_at)) === day)
    const place = dayBowel.find((r) => r.place)?.place ?? dayWellbeing.find((r) => r.place)?.place ?? null
    if (!place) continue
    const hasSymptom =
      dayBowel.some((r) => isSignificantBowel(r, DEFAULT_THRESHOLDS_FOR_AI)) ||
      dayWellbeing.some((r) => isSignificantWellbeing(r, DEFAULT_THRESHOLDS_FOR_AI))
    const stats = placeStats.get(place) ?? { total: 0, symptomDays: 0 }
    stats.total += 1
    if (hasSymptom) stats.symptomDays += 1
    placeStats.set(place, stats)
  }
  const placeSymptomRates = Array.from(placeStats.entries())
    .filter(([, stats]) => stats.total >= MIN_GROUP_SIZE)
    .map(([place, stats]) => ({ place, days: stats.total, symptomDays: stats.symptomDays }))

  const dayTagStress = (Object.keys(dayTagLabels) as DayTagKey[])
    .map((key) => {
      const withTag = dayClosingRows.filter((r) => r.tags.includes(key))
      const withoutTag = dayClosingRows.filter((r) => !r.tags.includes(key))
      if (withTag.length < MIN_GROUP_SIZE || withoutTag.length < MIN_GROUP_SIZE) return null
      return {
        label: dayTagLabels[key],
        count: withTag.length,
        avgStressWithTag: round1(withTag.reduce((s, r) => s + r.stress, 0) / withTag.length),
        avgStressWithoutTag: round1(withoutTag.reduce((s, r) => s + r.stress, 0) / withoutTag.length),
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)

  return {
    daysWithData: daysWithData.size,
    symptomWeeklyAverages,
    bristolAverage,
    flagRates,
    markerCorrelations,
    placeSymptomRates,
    dayTagStress,
  }
}

/** Feste Standard-Schwellen, nur für die interne KI-Statistik oben (nicht direkt angezeigt). */
const DEFAULT_THRESHOLDS_FOR_AI: ComplaintThresholds = { symptomMin: 5, bristolMin: 6, urgencyMin: 2, windowHours: 8 }

export async function fetchWeekInsights(stats: WeekInsightsStats): Promise<{ auffaellig: string[]; ideas: string[] } | null> {
  const { data, error } = await supabase.functions.invoke('week-insights', { body: { stats } })
  if (error) return null
  return data as { auffaellig: string[]; ideas: string[] }
}

export type LateEatingSleep = {
  lateCases: number
  notLateCases: number
  avgQualityLate: number | null
  avgQualityNotLate: number | null
}

export type MoodPoint = { date: string; avgMood: number | null; isStressDay: boolean }

export type WaterTimeBucket = { label: string; percent: number }

export type WaterStats = {
  avgMlPerDay: number
  avgGlassesPerDay: number
  avgWakeToFirstGlassMinutes: number | null
  wakeToFirstGlassCases: number
  firstGlassBeforeFirstMealPercent: number | null
  firstGlassBeforeFirstMealCases: number
  timeOfDayDistribution: WaterTimeBucket[]
}

/** Ein Marker (möglicher Auslöser) mit Beschwerde-Rate mit vs. ohne Marker bei Mahlzeiten. */
export type MarkerConnection = {
  markerKey: MarkerKey
  label: string
  withCount: number
  withComplaintCount: number
  withoutCount: number
  withoutComplaintCount: number
  withRatePercent: number
  withoutRatePercent: number
  diffPercentPoints: number
  avgSeverityWith: number | null
  avgSeverityWithout: number | null
}

export type MarkerCoOccurrence = { labelA: string; labelB: string; jointPercent: number }

/** Zusammenhang zwischen zwei Gruppen (z.B. "Wenig getrunken" vs. "Ausreichend getrunken") und der
 * Beschwerde-Rate in dieser Gruppe. Einheitliche Rate-Logik für Trinken/Schlaf/Stress/Essensrhythmus/Ort. */
export type OtherConnection = {
  key: string
  label: string
  groupALabel: string
  groupBLabel: string
  groupACount: number
  groupBCount: number
  groupAComplaintCount: number
  groupBComplaintCount: number
  groupARatePercent: number
  groupBRatePercent: number
  diffPercentPoints: number
}

export type WorstMomentMealInfo = { time: string; mealType: string; mainFoods: string[] }

export type WorstMoment = {
  id: string
  type: 'bowel' | 'wellbeing'
  time: string
  severity: number
  label: string
  place: string | null
  precedingMeals: WorstMomentMealInfo[]
  stress: number | null
  sleepQuality: number | null
}

export type WorstMomentMarkerSummary = { label: string; nearCount: number; totalMoments: number; overallSharePercent: number }

export type PeriodInsights = {
  periodDays: number | null
  daysWithData: number
  mealRhythm: MealRhythmStats
  sleep: SleepDurationStats
  lateEating: LateEatingSleep | null
  markerConnections: MarkerConnection[]
  noClearDifferenceMarkers: string[]
  markerCoOccurrences: MarkerCoOccurrence[]
  otherConnections: OtherConnection[]
  wellbeing: { avgMood: number | null; series: MoodPoint[] }
  water: WaterStats
  worstMoments: WorstMoment[]
  worstMomentsSummary: WorstMomentMarkerSummary[]
}

function hourOfDay(iso: string): number {
  return new Date(iso).getHours()
}

function isDayTracked(
  day: string,
  bowelRows: BowelRow[],
  wellbeingRows: WellbeingRow[],
  mealRows: MealRow[],
  dayClosingRows: DayClosingRow[],
  excludeMealId: string,
): boolean {
  if (dayClosingRows.some((r) => r.date === day)) return true
  if (bowelRows.some((r) => toDateOnly(new Date(r.occurred_at)) === day)) return true
  if (wellbeingRows.some((r) => toDateOnly(new Date(r.occurred_at)) === day)) return true
  if (mealRows.some((r) => r.id !== excludeMealId && toDateOnly(new Date(r.eaten_at)) === day)) return true
  return false
}

function complaintInWindow(
  windowStart: number,
  windowEnd: number,
  bowelRows: BowelRow[],
  wellbeingRows: WellbeingRow[],
  t: ComplaintThresholds,
): { hasEntry: boolean; isComplaint: boolean; severity: number } {
  const bowelInWindow = bowelRows.filter((r) => {
    const tm = new Date(r.occurred_at).getTime()
    return tm >= windowStart && tm <= windowEnd
  })
  const wellbeingInWindow = wellbeingRows.filter((r) => {
    const tm = new Date(r.occurred_at).getTime()
    return tm >= windowStart && tm <= windowEnd
  })
  let isComplaint = false
  let severity = 0
  for (const r of bowelInWindow) {
    if (isSignificantBowel(r, t)) {
      isComplaint = true
      severity = Math.max(severity, bowelSeverity(r))
    }
  }
  for (const r of wellbeingInWindow) {
    if (isSignificantWellbeing(r, t)) {
      isComplaint = true
      severity = Math.max(severity, wellbeingSeverity(r))
    }
  }
  return { hasEntry: bowelInWindow.length > 0 || wellbeingInWindow.length > 0, isComplaint, severity }
}

type MealEval = { meal: MealRow; counted: boolean; isComplaint: boolean; severity: number }

/** Bewertet jede Mahlzeit: zählt sie (nach der "Tag getrackt"-Regel), und gab es im Reaktionsfenster
 * (1h bis t.windowHours nach der Mahlzeit) eine signifikante Beschwerde? */
function evaluateMeals(
  mealRows: MealRow[],
  bowelRows: BowelRow[],
  wellbeingRows: WellbeingRow[],
  dayClosingRows: DayClosingRow[],
  t: ComplaintThresholds,
): MealEval[] {
  return mealRows.map((meal) => {
    const mealTime = new Date(meal.eaten_at).getTime()
    const windowStart = mealTime + COMPLAINT_WINDOW_START_HOURS * 3600000
    const windowEnd = mealTime + t.windowHours * 3600000
    const { hasEntry, isComplaint, severity } = complaintInWindow(windowStart, windowEnd, bowelRows, wellbeingRows, t)
    const day = toDateOnly(new Date(meal.eaten_at))
    const counted = isComplaint || hasEntry || isDayTracked(day, bowelRows, wellbeingRows, mealRows, dayClosingRows, meal.id)
    return { meal, counted, isComplaint, severity }
  })
}

function rateForGroup(evals: MealEval[], predicate: (m: MealRow) => boolean) {
  const withGroup = evals.filter((e) => e.counted && predicate(e.meal))
  const withoutGroup = evals.filter((e) => e.counted && !predicate(e.meal))
  const withComplaint = withGroup.filter((e) => e.isComplaint)
  const withoutComplaint = withoutGroup.filter((e) => e.isComplaint)
  return {
    withCount: withGroup.length,
    withComplaintCount: withComplaint.length,
    withoutCount: withoutGroup.length,
    withoutComplaintCount: withoutComplaint.length,
    avgSeverityWith: withComplaint.length ? round1(avg(withComplaint.map((e) => e.severity))) : null,
    avgSeverityWithout: withoutComplaint.length ? round1(avg(withoutComplaint.map((e) => e.severity))) : null,
  }
}

type MarkerEvalResult = { status: 'insufficient' } | { status: 'noClearDiff' } | { status: 'shown'; connection: MarkerConnection }

function evaluateMarkerConnection(key: MarkerKey, evals: MealEval[]): MarkerEvalResult {
  const r = rateForGroup(evals, (m) => m.markers.includes(key))
  if (r.withCount < PERIOD_MIN_CASES || r.withoutCount < PERIOD_MIN_CASES) return { status: 'insufficient' }
  const withRatePercent = Math.round((r.withComplaintCount / r.withCount) * 100)
  const withoutRatePercent = Math.round((r.withoutComplaintCount / r.withoutCount) * 100)
  const diffPercentPoints = withRatePercent - withoutRatePercent
  if (diffPercentPoints < MIN_DIFF_PERCENT_POINTS) return { status: 'noClearDiff' }
  return {
    status: 'shown',
    connection: { markerKey: key, label: markerLabels[key], ...r, withRatePercent, withoutRatePercent, diffPercentPoints },
  }
}

function computeMarkerCoOccurrences(mealRows: MealRow[]): MarkerCoOccurrence[] {
  const results: MarkerCoOccurrence[] = []
  for (let i = 0; i < markerKeys.length; i++) {
    for (let j = i + 1; j < markerKeys.length; j++) {
      const a = markerKeys[i]
      const b = markerKeys[j]
      const countA = mealRows.filter((m) => m.markers.includes(a)).length
      const countB = mealRows.filter((m) => m.markers.includes(b)).length
      if (countA < PERIOD_MIN_CASES || countB < PERIOD_MIN_CASES) continue
      const both = mealRows.filter((m) => m.markers.includes(a) && m.markers.includes(b)).length
      const jointPercent = Math.round((both / Math.min(countA, countB)) * 100)
      if (jointPercent > CO_OCCURRENCE_THRESHOLD_PERCENT) {
        results.push({ labelA: markerLabels[a], labelB: markerLabels[b], jointPercent })
      }
    }
  }
  return results
}

/** Allgemeiner Rate-Vergleich zweier Gruppen (Boolean-Flags = "hatte Beschwerde"). Gleiche 20pp/min-5-Regel
 * wie bei Markern, aber ohne Top-3-Deckel/"ohne klaren Unterschied"-Liste (nur bei Markern sinnvoll). */
function buildRateConnection(
  key: string,
  label: string,
  groupALabel: string,
  groupBLabel: string,
  groupAFlags: boolean[],
  groupBFlags: boolean[],
): OtherConnection | null {
  if (groupAFlags.length < PERIOD_MIN_CASES || groupBFlags.length < PERIOD_MIN_CASES) return null
  const groupAComplaintCount = groupAFlags.filter(Boolean).length
  const groupBComplaintCount = groupBFlags.filter(Boolean).length
  const groupARatePercent = Math.round((groupAComplaintCount / groupAFlags.length) * 100)
  const groupBRatePercent = Math.round((groupBComplaintCount / groupBFlags.length) * 100)
  const diffPercentPoints = groupARatePercent - groupBRatePercent
  if (Math.abs(diffPercentPoints) < MIN_DIFF_PERCENT_POINTS) return null
  return {
    key,
    label,
    groupALabel,
    groupBLabel,
    groupACount: groupAFlags.length,
    groupBCount: groupBFlags.length,
    groupAComplaintCount,
    groupBComplaintCount,
    groupARatePercent,
    groupBRatePercent,
    diffPercentPoints,
  }
}

/** Essensrhythmus/Schlaf/Zusammenhänge/Schlimmste Momente für einen wählbaren Zeitraum (1/2/4 Wochen oder alles).
 * Alle Kennzahlen werden hier im Code berechnet (keine KI). Übersichtswerte (Essensrhythmus, Schlaf, Trinken,
 * Befinden) werden immer zurückgegeben, auch bei wenigen Tagen – nur "Mögliche Zusammenhänge" braucht genug
 * Fälle je Vergleichsgruppe und bleibt sonst leer. */
export async function fetchPeriodInsights(
  userId: string,
  windowDays: number | null,
  thresholds: ComplaintThresholds,
): Promise<PeriodInsights> {
  const to = new Date()
  const from = windowDays ? new Date(to) : new Date(0)
  if (windowDays) {
    from.setDate(from.getDate() - (windowDays - 1))
    from.setHours(0, 0, 0, 0)
  }
  const dateFrom = toDateOnly(from)
  const dateTo = toDateOnly(to)

  const [bowelRes, wellbeingRes, mealsRes, dayClosingsRes, sleepLogRows, waterRows] = await Promise.all([
    supabase.from('bowel_movements').select('*').eq('user_id', userId).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    supabase.from('wellbeing').select('*').eq('user_id', userId).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    supabase.from('meals').select('*').eq('user_id', userId).gte('eaten_at', from.toISOString()).lte('eaten_at', to.toISOString()),
    supabase.from('day_closings').select('*').eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo),
    fetchSleepLogs(userId, from, to),
    fetchWaterLogs(userId, from, to),
  ])

  const bowelRows: BowelRow[] = bowelRes.data ?? []
  const wellbeingRows: WellbeingRow[] = wellbeingRes.data ?? []
  const mealRows: MealRow[] = mealsRes.data ?? []
  const dayClosingRows: DayClosingRow[] = dayClosingsRes.data ?? []

  const daysWithData = new Set<string>()
  for (const r of bowelRows) daysWithData.add(toDateOnly(new Date(r.occurred_at)))
  for (const r of wellbeingRows) daysWithData.add(toDateOnly(new Date(r.occurred_at)))
  for (const r of mealRows) daysWithData.add(toDateOnly(new Date(r.eaten_at)))
  for (const r of dayClosingRows) daysWithData.add(r.date)

  const mealRhythm = computeMealRhythm(mealRows, sleepLogRows)
  const sleep = computeSleepDuration(sleepLogRows)

  const dayWellbeingMap = new Map<string, WellbeingRow[]>()
  for (const r of wellbeingRows) {
    const day = toDateOnly(new Date(r.occurred_at))
    const arr = dayWellbeingMap.get(day) ?? []
    arr.push(r)
    dayWellbeingMap.set(day, arr)
  }

  const dayBowelMap = new Map<string, BowelRow[]>()
  for (const r of bowelRows) {
    const day = toDateOnly(new Date(r.occurred_at))
    const arr = dayBowelMap.get(day) ?? []
    arr.push(r)
    dayBowelMap.set(day, arr)
  }

  function dayHasComplaint(day: string): boolean {
    const b = dayBowelMap.get(day) ?? []
    const w = dayWellbeingMap.get(day) ?? []
    return b.some((r) => isSignificantBowel(r, thresholds)) || w.some((r) => isSignificantWellbeing(r, thresholds))
  }

  const dayMealMap = groupMealsByDay(mealRows)

  // Spätes Essen (<2h vor dem Schlafen): je Schlaf-Log mit bed_at die letzte Mahlzeit desselben Abends (night_of).
  const lateGaps: { gapMinutes: number; nightDate: string; nextMorning: string }[] = []
  for (const log of sleepLogRows) {
    if (!log.bed_at) continue
    const dayRows = dayMealMap.get(log.night_of)
    if (!dayRows || dayRows.length === 0) continue
    const lastMeal = dayRows.reduce((latest, m) => (new Date(m.eaten_at) > new Date(latest.eaten_at) ? m : latest))
    const gapMinutes = (new Date(log.bed_at).getTime() - new Date(lastMeal.eaten_at).getTime()) / 60000
    if (gapMinutes > 0 && gapMinutes < 16 * 60) {
      const nextMorning = new Date(`${log.night_of}T12:00:00`)
      nextMorning.setDate(nextMorning.getDate() + 1)
      lateGaps.push({ gapMinutes, nightDate: log.night_of, nextMorning: toDateOnly(nextMorning) })
    }
  }
  const lateNights = lateGaps.filter((g) => g.gapMinutes < 120)
  const notLateNights = lateGaps.filter((g) => g.gapMinutes >= 120)
  let lateEating: LateEatingSleep | null = null
  if (lateNights.length >= PERIOD_MIN_CASES && notLateNights.length >= PERIOD_MIN_CASES) {
    const qualityFor = (nights: typeof lateGaps) => {
      const qs = nights
        .map((n) => sleepLogRows.find((log) => log.night_of === n.nightDate)?.quality)
        .filter((q): q is number => q !== null && q !== undefined)
      return qs.length ? round1(avg(qs)) : null
    }
    lateEating = {
      lateCases: lateNights.length,
      notLateCases: notLateNights.length,
      avgQualityLate: qualityFor(lateNights),
      avgQualityNotLate: qualityFor(notLateNights),
    }
  }

  // Beschwerden im Reaktionsfenster (1h bis einstellbare Stunden) nach Mahlzeiten, pro Marker Rate mit vs. ohne.
  const markerEvaluations = evaluateMeals(mealRows, bowelRows, wellbeingRows, dayClosingRows, thresholds)
  const markerResults = markerKeys.map((key) => ({ key, result: evaluateMarkerConnection(key, markerEvaluations) }))
  const passingMarkers = markerResults
    .filter((r): r is { key: MarkerKey; result: { status: 'shown'; connection: MarkerConnection } } => r.result.status === 'shown')
    .map((r) => r.result.connection)
    .sort((a, b) => b.diffPercentPoints - a.diffPercentPoints)
  const markerConnections = passingMarkers.slice(0, 3)
  const shownKeys = new Set(markerConnections.map((c) => c.markerKey))
  const noClearDifferenceMarkers = markerResults
    .filter((r) => r.result.status !== 'insufficient' && !shownKeys.has(r.key))
    .map((r) => markerLabels[r.key])

  const markerCoOccurrences = computeMarkerCoOccurrences(mealRows)

  const otherConnections: OtherConnection[] = []

  // Unregelmäßige vs. regelmäßige Tage (Mahlzeit weicht >90 Min. vom Median ihres Typs ab).
  {
    const irregularFlags: boolean[] = []
    const regularFlags: boolean[] = []
    for (const [day, dayRows] of dayMealMap) {
      const isIrregular = dayRows.some((m) => {
        const typeStats = mealRhythm.byMealType.find((t) => t.mealType === m.meal_type)
        if (!typeStats || typeStats.medianMinutes === null) return false
        return Math.abs(minutesOfDay(m.eaten_at) - typeStats.medianMinutes) > 90
      })
      if (isIrregular) irregularFlags.push(dayHasComplaint(day))
      else regularFlags.push(dayHasComplaint(day))
    }
    const c = buildRateConnection('mealTiming', 'Essenszeiten', 'Unregelmäßige Tage', 'Regelmäßige Tage', irregularFlags, regularFlags)
    if (c) otherConnections.push(c)
  }

  // Stress vs. Beschwerden am selben Tag.
  {
    const highStressFlags = dayClosingRows.filter((dc) => dc.stress >= 4).map((dc) => dayHasComplaint(dc.date))
    const normalStressFlags = dayClosingRows.filter((dc) => dc.stress < 4).map((dc) => dayHasComplaint(dc.date))
    const c = buildRateConnection('stress', 'Stress', 'Hoher Stress', 'Normaler Stress', highStressFlags, normalStressFlags)
    if (c) otherConnections.push(c)
  }

  // Trinkmenge eines Tages vs. Beschwerden am selben Tag.
  const waterByDay = new Map<string, number>()
  for (const w of waterRows) {
    const day = toDateOnly(new Date(w.drunk_at))
    waterByDay.set(day, (waterByDay.get(day) ?? 0) + w.amount_ml)
  }
  {
    const lowWaterFlags: boolean[] = []
    const enoughWaterFlags: boolean[] = []
    for (const [day, ml] of waterByDay) {
      if (ml < 1500) lowWaterFlags.push(dayHasComplaint(day))
      else enoughWaterFlags.push(dayHasComplaint(day))
    }
    const c = buildRateConnection('waterAmount', 'Trinkmenge', 'Wenig getrunken (<1,5 l)', 'Ausreichend getrunken', lowWaterFlags, enoughWaterFlags)
    if (c) otherConnections.push(c)
  }

  // Trinken zur Mahlzeit (±30 Min.) vs. Beschwerden im Reaktionsfenster danach.
  {
    const nearMealFlags: boolean[] = []
    const notNearMealFlags: boolean[] = []
    for (const e of markerEvaluations) {
      if (!e.counted) continue
      const mealTime = new Date(e.meal.eaten_at).getTime()
      const hasNearbyWater = waterRows.some((w) => Math.abs(new Date(w.drunk_at).getTime() - mealTime) <= 30 * 60000)
      if (hasNearbyWater) nearMealFlags.push(e.isComplaint)
      else notNearMealFlags.push(e.isComplaint)
    }
    const c = buildRateConnection('waterNearMeal', 'Trinken zur Mahlzeit (±30 Min.)', 'Mit Getränk zur Mahlzeit', 'Ohne Getränk zur Mahlzeit', nearMealFlags, notNearMealFlags)
    if (c) otherConnections.push(c)
  }

  // Trinken in den 3h vor einem Befinden-Eintrag vs. ob dieser Eintrag eine signifikante Beschwerde ist.
  {
    const lowWaterBeforeFlags: boolean[] = []
    const enoughWaterBeforeFlags: boolean[] = []
    for (const w of wellbeingRows) {
      const t = new Date(w.occurred_at).getTime()
      const mlBefore = waterRows
        .filter((wl) => {
          const wt = new Date(wl.drunk_at).getTime()
          return wt <= t && wt >= t - 3 * 3600000
        })
        .reduce((s, wl) => s + wl.amount_ml, 0)
      const flag = isSignificantWellbeing(w, thresholds)
      if (mlBefore < 250) lowWaterBeforeFlags.push(flag)
      else enoughWaterBeforeFlags.push(flag)
    }
    const c = buildRateConnection(
      'waterBeforeWellbeing',
      'Trinken vor Befinden-Eintrag',
      'Wenig getrunken (<250 ml, letzte 3h)',
      'Mind. ein Glas getrunken',
      lowWaterBeforeFlags,
      enoughWaterBeforeFlags,
    )
    if (c) otherConnections.push(c)
  }

  // Trinkmenge eines Tages vs. signifikante Stuhl-Beschwerde am nächsten Tag.
  {
    const lowWaterNextDayFlags: boolean[] = []
    const enoughWaterNextDayFlags: boolean[] = []
    for (const [day, ml] of waterByDay) {
      const nextDay = new Date(`${day}T12:00:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      const dayBowelRows = dayBowelMap.get(toDateOnly(nextDay)) ?? []
      if (dayBowelRows.length === 0) continue
      const flag = dayBowelRows.some((r) => isSignificantBowel(r, thresholds))
      if (ml < 1500) lowWaterNextDayFlags.push(flag)
      else enoughWaterNextDayFlags.push(flag)
    }
    const c = buildRateConnection(
      'waterBristolNextDay',
      'Trinkmenge & Stuhl am nächsten Tag',
      'Wenig getrunken (<1,5 l)',
      'Ausreichend getrunken',
      lowWaterNextDayFlags,
      enoughWaterNextDayFlags,
    )
    if (c) otherConnections.push(c)
  }

  // Schlafqualität der Nacht vor einem Tag vs. Beschwerden an diesem Tag.
  {
    const poorSleepFlags: boolean[] = []
    const goodSleepFlags: boolean[] = []
    for (const log of sleepLogRows) {
      if (log.quality === null) continue
      const nextDay = new Date(`${log.night_of}T12:00:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      const nextDayStr = toDateOnly(nextDay)
      if (!daysWithData.has(nextDayStr)) continue
      const flag = dayHasComplaint(nextDayStr)
      if (log.quality <= 2) poorSleepFlags.push(flag)
      else if (log.quality >= 4) goodSleepFlags.push(flag)
    }
    const c = buildRateConnection('sleepQuality', 'Schlafqualität', 'Schlecht geschlafen', 'Gut geschlafen', poorSleepFlags, goodSleepFlags)
    if (c) otherConnections.push(c)
  }

  // Spätes Essen vs. signifikante Stuhl-Beschwerde am nächsten Morgen.
  {
    const lateFlags: boolean[] = []
    const notLateFlags: boolean[] = []
    for (const g of lateGaps) {
      const dayBowelRows = dayBowelMap.get(g.nextMorning) ?? []
      if (dayBowelRows.length === 0) continue
      const flag = dayBowelRows.some((r) => isSignificantBowel(r, thresholds))
      if (g.gapMinutes < 120) lateFlags.push(flag)
      else notLateFlags.push(flag)
    }
    const c = buildRateConnection('lateEatingBowel', 'Spätes Essen & Stuhl', 'Spät gegessen (<2h vor dem Schlafen)', 'Früher gegessen', lateFlags, notLateFlags)
    if (c) otherConnections.push(c)
  }

  // Ort vs. Beschwerden (nur die zwei häufigsten Orte mit genug Fällen).
  {
    const placeDayFlags = new Map<string, boolean[]>()
    for (const day of daysWithData) {
      const dayBowel = dayBowelMap.get(day) ?? []
      const dayWellbeing = dayWellbeingMap.get(day) ?? []
      const place = dayBowel.find((r) => r.place)?.place ?? dayWellbeing.find((r) => r.place)?.place ?? null
      if (!place) continue
      const arr = placeDayFlags.get(place) ?? []
      arr.push(dayHasComplaint(day))
      placeDayFlags.set(place, arr)
    }
    const placeEntries = Array.from(placeDayFlags.entries())
      .filter(([, flags]) => flags.length >= PERIOD_MIN_CASES)
      .sort((a, b) => b[1].length - a[1].length)
    if (placeEntries.length >= 2) {
      const [[placeA, flagsA], [placeB, flagsB]] = placeEntries
      const c = buildRateConnection('place', 'Ort', placeA, placeB, flagsA, flagsB)
      if (c) otherConnections.push(c)
    }
  }

  // Befinden für den gewählten Zeitraum.
  const moodSeries: MoodPoint[] = Array.from(dayWellbeingMap.keys())
    .sort()
    .map((day) => {
      const rows = dayWellbeingMap.get(day) ?? []
      return {
        date: day,
        avgMood: rows.length ? round1(avg(rows.map((r) => r.mood))) : null,
        isStressDay: (dayClosingRows.find((r) => r.date === day)?.stress ?? 0) >= 4,
      }
    })
  const moodValues = moodSeries.map((m) => m.avgMood).filter((m): m is number => m !== null)
  const avgMood = moodValues.length ? round1(avg(moodValues)) : null

  // "Alles" hat kein festes Fenster – Anzahl Tage ergibt sich aus dem ersten Wasser-Log bis heute.
  const waterWindowDays =
    windowDays ??
    (waterRows.length
      ? Math.max(1, Math.round((to.getTime() - new Date(waterRows[0].drunk_at).getTime()) / 86400000) + 1)
      : 1)

  // Aufwachen -> erstes Glas Wasser.
  const wakeToFirstGlassGaps: number[] = []
  for (const log of sleepLogRows) {
    if (!log.woke_at) continue
    const wokeTime = new Date(log.woke_at).getTime()
    const wokeDay = toDateOnly(new Date(log.woke_at))
    const firstGlassAfterWaking = waterRows
      .filter((w) => toDateOnly(new Date(w.drunk_at)) === wokeDay && new Date(w.drunk_at).getTime() >= wokeTime)
      .sort((a, b) => new Date(a.drunk_at).getTime() - new Date(b.drunk_at).getTime())[0]
    if (!firstGlassAfterWaking) continue
    const gapMinutes = (new Date(firstGlassAfterWaking.drunk_at).getTime() - wokeTime) / 60000
    if (gapMinutes >= 0 && gapMinutes <= 6 * 60) wakeToFirstGlassGaps.push(gapMinutes)
  }

  // Erstes Glas Wasser vs. erste Mahlzeit desselben Tages.
  let firstGlassBeforeMealCases = 0
  let firstGlassBeforeMeal = 0
  for (const day of daysWithData) {
    const dayWater = waterRows.filter((w) => toDateOnly(new Date(w.drunk_at)) === day)
    const dayMeals = dayMealMap.get(day) ?? []
    if (dayWater.length === 0 || dayMeals.length === 0) continue
    const firstWaterTime = Math.min(...dayWater.map((w) => new Date(w.drunk_at).getTime()))
    const firstMealTime = Math.min(...dayMeals.map((m) => new Date(m.eaten_at).getTime()))
    firstGlassBeforeMealCases++
    if (firstWaterTime < firstMealTime) firstGlassBeforeMeal++
  }

  // Tageszeit-Verteilung der Gläser.
  const timeBuckets: { label: string; test: (h: number) => boolean }[] = [
    { label: 'Morgens (5–11 Uhr)', test: (h) => h >= 5 && h < 11 },
    { label: 'Mittags (11–15 Uhr)', test: (h) => h >= 11 && h < 15 },
    { label: 'Nachmittags (15–18 Uhr)', test: (h) => h >= 15 && h < 18 },
    { label: 'Abends (18–23 Uhr)', test: (h) => h >= 18 && h < 23 },
    { label: 'Nachts (23–5 Uhr)', test: (h) => h >= 23 || h < 5 },
  ]
  const timeOfDayDistribution =
    waterRows.length >= PERIOD_MIN_CASES
      ? timeBuckets
          .map((b) => ({
            label: b.label,
            percent: Math.round((waterRows.filter((w) => b.test(hourOfDay(w.drunk_at))).length / waterRows.length) * 100),
          }))
          .filter((b) => b.percent > 0)
      : []

  // Schlimmste Momente: die 5 stärksten Beschwerde-Ereignisse im Zeitraum, mit Kontext davor.
  const complaintEvents = collectComplaintEvents(bowelRows, wellbeingRows, thresholds).slice(0, 5)
  const momentsWithMeals = complaintEvents.map((ev) => {
    const momentTime = new Date(ev.time).getTime()
    const windowStart = momentTime - thresholds.windowHours * 3600000
    const meals = mealRows
      .filter((m) => {
        const mt = new Date(m.eaten_at).getTime()
        return mt <= momentTime && mt >= windowStart
      })
      .sort((a, b) => new Date(a.eaten_at).getTime() - new Date(b.eaten_at).getTime())
    return { ev, meals }
  })
  const worstMoments: WorstMoment[] = momentsWithMeals.map(({ ev, meals }) => {
    const momentDay = toDateOnly(new Date(ev.time))
    const nightBefore = toDateOnly(addDays(new Date(ev.time), -1))
    return {
      id: ev.id,
      type: ev.type,
      time: ev.time,
      severity: ev.severity,
      label: ev.label,
      place: ev.place,
      precedingMeals: meals.map((m) => ({ time: m.eaten_at, mealType: m.meal_type, mainFoods: m.main_foods })),
      stress: dayClosingRows.find((dc) => dc.date === momentDay)?.stress ?? null,
      sleepQuality: sleepLogRows.find((log) => log.night_of === nightBefore)?.quality ?? null,
    }
  })
  const totalMoments = momentsWithMeals.length
  const markerNearCount = new Map<MarkerKey, number>()
  for (const { meals } of momentsWithMeals) {
    const present = new Set<MarkerKey>()
    for (const m of meals) for (const mk of m.markers) present.add(mk as MarkerKey)
    for (const mk of present) markerNearCount.set(mk, (markerNearCount.get(mk) ?? 0) + 1)
  }
  const totalMealsInPeriod = mealRows.length
  const worstMomentsSummary: WorstMomentMarkerSummary[] = Array.from(markerNearCount.entries())
    .map(([key, nearCount]) => ({
      label: markerLabels[key],
      nearCount,
      totalMoments,
      overallSharePercent: totalMealsInPeriod ? Math.round((mealRows.filter((m) => m.markers.includes(key)).length / totalMealsInPeriod) * 100) : 0,
    }))
    .filter((s) => s.nearCount >= 1)
    .sort((a, b) => b.nearCount / b.totalMoments - a.nearCount / a.totalMoments || b.nearCount - a.nearCount)
    .slice(0, 3)

  return {
    periodDays: windowDays,
    daysWithData: daysWithData.size,
    mealRhythm,
    sleep,
    lateEating,
    markerConnections,
    noClearDifferenceMarkers,
    markerCoOccurrences,
    otherConnections,
    wellbeing: { avgMood, series: moodSeries },
    water: {
      avgMlPerDay: totalMl(waterRows) / waterWindowDays,
      avgGlassesPerDay: waterRows.length / waterWindowDays,
      avgWakeToFirstGlassMinutes:
        wakeToFirstGlassGaps.length >= PERIOD_MIN_CASES ? Math.round(avg(wakeToFirstGlassGaps)) : null,
      wakeToFirstGlassCases: wakeToFirstGlassGaps.length,
      firstGlassBeforeFirstMealPercent:
        firstGlassBeforeMealCases >= PERIOD_MIN_CASES
          ? Math.round((firstGlassBeforeMeal / firstGlassBeforeMealCases) * 100)
          : null,
      firstGlassBeforeFirstMealCases: firstGlassBeforeMealCases,
      timeOfDayDistribution,
    },
    worstMoments,
    worstMomentsSummary,
  }
}
