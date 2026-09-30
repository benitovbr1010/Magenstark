import { dayTagLabels, flagLabels, markerLabels } from './constants'
import type { Database } from './database.types'
import { toDateOnly } from './datetime'
import { supabase } from './supabaseClient'

type BowelRow = Database['public']['Tables']['bowel_movements']['Row']
type WellbeingRow = Database['public']['Tables']['wellbeing']['Row']
type MarkerKey = keyof typeof markerLabels
type DayTagKey = keyof typeof dayTagLabels

const WINDOW_DAYS = 42
const MIN_DAYS_WITH_DATA = 21
const MIN_GROUP_SIZE = 3

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
  const sum = rows.reduce((s, r) => s + r.abdominal_pain + r.bloating + r.nausea + r.fullness + r.urgency, 0)
  return sum / rows.length / 5
}

function hasBowelSymptom(row: BowelRow): boolean {
  return row.pain || row.urgent || row.incomplete || row.mucus || row.blood
}

function hasWellbeingSymptom(row: WellbeingRow): boolean {
  return row.abdominal_pain > 0 || row.bloating > 0 || row.nausea > 0 || row.fullness > 0 || row.urgency > 0
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

  const flagDefs: { key: keyof Pick<BowelRow, 'pain' | 'urgent' | 'incomplete' | 'mucus' | 'blood'>; label: string }[] = [
    { key: 'pain', label: flagLabels.pain },
    { key: 'urgent', label: flagLabels.urgent },
    { key: 'incomplete', label: flagLabels.incomplete },
    { key: 'mucus', label: flagLabels.mucus },
    { key: 'blood', label: flagLabels.blood },
  ]
  const flagRates = bowelRows.length
    ? flagDefs
        .map((f) => ({ label: f.label, percent: Math.round((bowelRows.filter((r) => r[f.key]).length / bowelRows.length) * 100) }))
        .filter((f) => f.percent > 0)
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
