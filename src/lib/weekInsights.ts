import { dayTagLabels, flagLabels, markerLabels, symptomLabels } from './constants'
import type { Database } from './database.types'
import { toDateOnly } from './datetime'
import { computeMealRhythm, computeSleepDuration, groupMealsByDay, minutesOfDay, type MealRhythmStats, type SleepDurationStats } from './mealRhythm'
import { supabase } from './supabaseClient'
import { fetchWaterLogs } from './water'

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
/** Mindestanzahl Fälle je Vergleichsgruppe für die "Mögliche Zusammenhänge"-Karte (SPEC-Vorgabe: min. 5). */
const PERIOD_MIN_CASES = 5

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

function dailySymptomScore(rows: WellbeingRow[]): number | null {
  if (rows.length === 0) return null
  const sum = rows.reduce((s, r) => s + symptomKeys.reduce((acc, key) => acc + r[key], 0), 0)
  return sum / rows.length / symptomKeys.length
}

function hasBowelSymptom(row: BowelRow): boolean {
  return row.pain || row.urgency > 0 || row.incomplete || row.mucus || row.blood
}

function hasWellbeingSymptom(row: WellbeingRow): boolean {
  return symptomKeys.some((key) => row[key] > 0)
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
    const hasSymptom = dayBowel.some(hasBowelSymptom) || dayWellbeing.some(hasWellbeingSymptom)
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

export async function fetchWeekInsights(stats: WeekInsightsStats): Promise<{ auffaellig: string[]; ideas: string[] } | null> {
  const { data, error } = await supabase.functions.invoke('week-insights', { body: { stats } })
  if (error) return null
  return data as { auffaellig: string[]; ideas: string[] }
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

export type RatioConnection = {
  type: 'ratio'
  label: string
  withCount: number
  withSymptomCount: number
  withoutCount: number
  withoutSymptomCount: number
}

export type AverageConnection = {
  type: 'average'
  label: string
  groupALabel: string
  groupBLabel: string
  groupACount: number
  groupBCount: number
  groupAAvg: number
  groupBAvg: number
  unit: string
}

export type Connection = RatioConnection | AverageConnection

export type LateEatingSleep = {
  lateCases: number
  notLateCases: number
  avgQualityLate: number | null
  avgQualityNotLate: number | null
}

export type PeriodInsights = {
  periodDays: number | null
  daysWithData: number
  mealRhythm: MealRhythmStats
  sleep: SleepDurationStats
  lateEating: LateEatingSleep | null
  connections: Connection[]
}

/** Essensrhythmus/Schlaf/Zusammenhänge für einen wählbaren Zeitraum (1/2/4 Wochen oder alles, SPEC §6.3 Erweiterung).
 * Alle Kennzahlen werden hier im Code berechnet (keine KI) – analog zur bestehenden „Nach Ort”-Karte. */
export async function fetchPeriodInsights(userId: string, windowDays: number | null): Promise<PeriodInsights | null> {
  const to = new Date()
  const from = windowDays ? new Date(to) : new Date(0)
  if (windowDays) {
    from.setDate(from.getDate() - (windowDays - 1))
    from.setHours(0, 0, 0, 0)
  }
  const dateFrom = toDateOnly(from)
  const dateTo = toDateOnly(to)

  const [bowelRes, wellbeingRes, mealsRes, dayClosingsRes, waterRows] = await Promise.all([
    supabase.from('bowel_movements').select('*').eq('user_id', userId).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    supabase.from('wellbeing').select('*').eq('user_id', userId).gte('occurred_at', from.toISOString()).lte('occurred_at', to.toISOString()),
    supabase.from('meals').select('*').eq('user_id', userId).gte('eaten_at', from.toISOString()).lte('eaten_at', to.toISOString()),
    supabase.from('day_closings').select('*').eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo),
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

  const requiredDays = windowDays ? Math.max(4, Math.ceil(windowDays * 0.5)) : 10
  if (daysWithData.size < requiredDays) return null

  const mealRhythm = computeMealRhythm(mealRows, dayClosingRows)
  const sleep = computeSleepDuration(dayClosingRows)

  const dayWellbeingMap = new Map<string, WellbeingRow[]>()
  for (const r of wellbeingRows) {
    const day = toDateOnly(new Date(r.occurred_at))
    const arr = dayWellbeingMap.get(day) ?? []
    arr.push(r)
    dayWellbeingMap.set(day, arr)
  }
  const symptomByDay = new Map<string, number>()
  for (const [day, rows] of dayWellbeingMap) {
    const score = dailySymptomScore(rows)
    if (score !== null) symptomByDay.set(day, score)
  }

  const dayBowelMap = new Map<string, BowelRow[]>()
  for (const r of bowelRows) {
    const day = toDateOnly(new Date(r.occurred_at))
    const arr = dayBowelMap.get(day) ?? []
    arr.push(r)
    dayBowelMap.set(day, arr)
  }
  const bristolByDay = new Map<string, number>()
  for (const [day, rows] of dayBowelMap) bristolByDay.set(day, avg(rows.map((r) => r.bristol)))

  const dayMealMap = groupMealsByDay(mealRows)

  // Spätes Essen (<2h vor dem Schlafen): je Tagesabschluss mit bedtime die letzte Mahlzeit des Vorabends.
  const lateGaps: { gapMinutes: number; nightDate: string }[] = []
  for (const dc of dayClosingRows) {
    if (!dc.bedtime) continue
    const previousDay = new Date(`${dc.date}T12:00:00`)
    previousDay.setDate(previousDay.getDate() - 1)
    const dayRows = dayMealMap.get(toDateOnly(previousDay))
    if (!dayRows || dayRows.length === 0) continue
    const lastMeal = dayRows.reduce((latest, m) => (new Date(m.eaten_at) > new Date(latest.eaten_at) ? m : latest))
    const gapMinutes = (new Date(dc.bedtime).getTime() - new Date(lastMeal.eaten_at).getTime()) / 60000
    if (gapMinutes > 0 && gapMinutes < 16 * 60) lateGaps.push({ gapMinutes, nightDate: dc.date })
  }
  const lateNights = lateGaps.filter((g) => g.gapMinutes < 120)
  const notLateNights = lateGaps.filter((g) => g.gapMinutes >= 120)
  let lateEating: LateEatingSleep | null = null
  if (lateNights.length >= PERIOD_MIN_CASES && notLateNights.length >= PERIOD_MIN_CASES) {
    const qualityFor = (nights: typeof lateGaps) => {
      const qs = nights
        .map((n) => dayClosingRows.find((dc) => dc.date === n.nightDate)?.sleep)
        .filter((q): q is number => q !== undefined)
      return qs.length ? round1(avg(qs)) : null
    }
    lateEating = {
      lateCases: lateNights.length,
      notLateCases: notLateNights.length,
      avgQualityLate: qualityFor(lateNights),
      avgQualityNotLate: qualityFor(notLateNights),
    }
  }

  const connections: Connection[] = []

  // Beschwerden 2–24h nach Mahlzeiten MIT Marker X vs. OHNE Marker X.
  for (const key of markerKeys) {
    let withCount = 0
    let withSymptomCount = 0
    let withoutCount = 0
    let withoutSymptomCount = 0
    for (const meal of mealRows) {
      const mealTime = new Date(meal.eaten_at).getTime()
      const windowStart = mealTime + 2 * 3600000
      const windowEnd = mealTime + 24 * 3600000
      const followups = wellbeingRows.filter((w) => {
        const t = new Date(w.occurred_at).getTime()
        return t >= windowStart && t <= windowEnd
      })
      if (followups.length === 0) continue
      const symptomatic = followups.some(hasWellbeingSymptom)
      if (meal.markers.includes(key)) {
        withCount++
        if (symptomatic) withSymptomCount++
      } else {
        withoutCount++
        if (symptomatic) withoutSymptomCount++
      }
    }
    if (withCount >= PERIOD_MIN_CASES && withoutCount >= PERIOD_MIN_CASES) {
      connections.push({ type: 'ratio', label: markerLabels[key], withCount, withSymptomCount, withoutCount, withoutSymptomCount })
    }
  }

  // Unregelmäßige vs. regelmäßige Tage (Mahlzeit weicht >90 Min. vom Median ihres Typs ab).
  const irregularScores: number[] = []
  const regularScores: number[] = []
  for (const [day, dayRows] of dayMealMap) {
    const score = symptomByDay.get(day)
    if (score === undefined) continue
    const isIrregular = dayRows.some((m) => {
      const typeStats = mealRhythm.byMealType.find((t) => t.mealType === m.meal_type)
      if (!typeStats || typeStats.medianMinutes === null) return false
      return Math.abs(minutesOfDay(m.eaten_at) - typeStats.medianMinutes) > 90
    })
    if (isIrregular) irregularScores.push(score)
    else regularScores.push(score)
  }
  if (irregularScores.length >= PERIOD_MIN_CASES && regularScores.length >= PERIOD_MIN_CASES) {
    connections.push({
      type: 'average',
      label: 'Essenszeiten',
      groupALabel: 'Unregelmäßige Tage',
      groupBLabel: 'Regelmäßige Tage',
      groupACount: irregularScores.length,
      groupBCount: regularScores.length,
      groupAAvg: round1(avg(irregularScores)),
      groupBAvg: round1(avg(regularScores)),
      unit: 'Symptom-Wert (0–10)',
    })
  }

  // Stress vs. Beschwerden.
  const highStressScores: number[] = []
  const normalStressScores: number[] = []
  for (const dc of dayClosingRows) {
    const score = symptomByDay.get(dc.date)
    if (score === undefined) continue
    if (dc.stress >= 4) highStressScores.push(score)
    else normalStressScores.push(score)
  }
  if (highStressScores.length >= PERIOD_MIN_CASES && normalStressScores.length >= PERIOD_MIN_CASES) {
    connections.push({
      type: 'average',
      label: 'Stress',
      groupALabel: 'Hoher Stress',
      groupBLabel: 'Normaler Stress',
      groupACount: highStressScores.length,
      groupBCount: normalStressScores.length,
      groupAAvg: round1(avg(highStressScores)),
      groupBAvg: round1(avg(normalStressScores)),
      unit: 'Symptom-Wert (0–10)',
    })
  }

  // Wassermenge vs. Beschwerden.
  const waterByDay = new Map<string, number>()
  for (const w of waterRows) {
    const day = toDateOnly(new Date(w.drunk_at))
    waterByDay.set(day, (waterByDay.get(day) ?? 0) + w.amount_ml)
  }
  const lowWaterScores: number[] = []
  const enoughWaterScores: number[] = []
  for (const [day, ml] of waterByDay) {
    const score = symptomByDay.get(day)
    if (score === undefined) continue
    if (ml < 1500) lowWaterScores.push(score)
    else enoughWaterScores.push(score)
  }
  if (lowWaterScores.length >= PERIOD_MIN_CASES && enoughWaterScores.length >= PERIOD_MIN_CASES) {
    connections.push({
      type: 'average',
      label: 'Trinkmenge',
      groupALabel: 'Wenig getrunken (<1,5 l)',
      groupBLabel: 'Ausreichend getrunken',
      groupACount: lowWaterScores.length,
      groupBCount: enoughWaterScores.length,
      groupAAvg: round1(avg(lowWaterScores)),
      groupBAvg: round1(avg(enoughWaterScores)),
      unit: 'Symptom-Wert (0–10)',
    })
  }

  // Schlafqualität vs. Beschwerden am Folgetag.
  const poorSleepScores: number[] = []
  const goodSleepScores: number[] = []
  for (const dc of dayClosingRows) {
    const score = symptomByDay.get(dc.date)
    if (score === undefined) continue
    if (dc.sleep <= 2) poorSleepScores.push(score)
    else if (dc.sleep >= 4) goodSleepScores.push(score)
  }
  if (poorSleepScores.length >= PERIOD_MIN_CASES && goodSleepScores.length >= PERIOD_MIN_CASES) {
    connections.push({
      type: 'average',
      label: 'Schlafqualität',
      groupALabel: 'Schlecht geschlafen',
      groupBLabel: 'Gut geschlafen',
      groupACount: poorSleepScores.length,
      groupBCount: goodSleepScores.length,
      groupAAvg: round1(avg(poorSleepScores)),
      groupBAvg: round1(avg(goodSleepScores)),
      unit: 'Symptom-Wert (0–10)',
    })
  }

  // Spätes Essen vs. Stuhl am nächsten Morgen.
  const lateBristol: number[] = []
  const notLateBristol: number[] = []
  for (const g of lateGaps) {
    const b = bristolByDay.get(g.nightDate)
    if (b === undefined) continue
    if (g.gapMinutes < 120) lateBristol.push(b)
    else notLateBristol.push(b)
  }
  if (lateBristol.length >= PERIOD_MIN_CASES && notLateBristol.length >= PERIOD_MIN_CASES) {
    connections.push({
      type: 'average',
      label: 'Spätes Essen & Stuhl',
      groupALabel: 'Spät gegessen (<2h vor dem Schlafen)',
      groupBLabel: 'Früher gegessen',
      groupACount: lateBristol.length,
      groupBCount: notLateBristol.length,
      groupAAvg: round1(avg(lateBristol)),
      groupBAvg: round1(avg(notLateBristol)),
      unit: 'Bristol-Wert (1–7)',
    })
  }

  // Ort vs. Beschwerden (nur die zwei häufigsten Orte mit genug Fällen).
  const placeScores = new Map<string, number[]>()
  for (const day of daysWithData) {
    const dayBowel = dayBowelMap.get(day) ?? []
    const dayWellbeing = dayWellbeingMap.get(day) ?? []
    const place = dayBowel.find((r) => r.place)?.place ?? dayWellbeing.find((r) => r.place)?.place ?? null
    if (!place) continue
    const score = symptomByDay.get(day)
    if (score === undefined) continue
    const arr = placeScores.get(place) ?? []
    arr.push(score)
    placeScores.set(place, arr)
  }
  const placeEntries = Array.from(placeScores.entries())
    .filter(([, scores]) => scores.length >= PERIOD_MIN_CASES)
    .sort((a, b) => b[1].length - a[1].length)
  if (placeEntries.length >= 2) {
    const [[placeA, scoresA], [placeB, scoresB]] = placeEntries
    connections.push({
      type: 'average',
      label: 'Ort',
      groupALabel: placeA,
      groupBLabel: placeB,
      groupACount: scoresA.length,
      groupBCount: scoresB.length,
      groupAAvg: round1(avg(scoresA)),
      groupBAvg: round1(avg(scoresB)),
      unit: 'Symptom-Wert (0–10)',
    })
  }

  return {
    periodDays: windowDays,
    daysWithData: daysWithData.size,
    mealRhythm,
    sleep,
    lateEating,
    connections,
  }
}
