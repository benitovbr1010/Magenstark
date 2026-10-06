// Essensrhythmus- und Schlafdauer-Berechnung: reine Funktionen, die Mahlzeiten-/Schlaf-Zeilen
// (beliebiger Zeitraum) zu Kennzahlen verdichten. Von weekInsights.ts (Wochenübersicht) UND report.ts
// (Arztbericht, "nur Zahlen") gemeinsam genutzt, damit beide Stellen dieselbe Logik verwenden.
import { mealTypeLabels } from './constants'
import type { Database } from './database.types'
import { toDateOnly } from './datetime'

type MealRow = Database['public']['Tables']['meals']['Row']
type SleepLogRow = Database['public']['Tables']['sleep_logs']['Row']
export type MealTypeKey = keyof typeof mealTypeLabels

const REGULAR_MEAL_TYPES: MealTypeKey[] = ['fruehstueck', 'mittag', 'abend']

export function minutesOfDay(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export type MealTypeRhythm = {
  mealType: MealTypeKey
  label: string
  count: number
  earliest: string | null
  latest: string | null
  medianMinutes: number | null
  rangeMinutes: number | null
  regularity: 'regelmäßig' | 'unregelmäßig' | 'sehr unregelmäßig' | null
  skippedDays: number
}

export type MealRhythmStats = {
  byMealType: MealTypeRhythm[]
  longestGapHours: number | null
  avgLastMealToBedtimeMinutes: number | null
  lastMealToBedtimeCases: number
  daysConsidered: number
}

/** Gruppiert Mahlzeiten nach Kalendertag (lokale Zeit). */
export function groupMealsByDay(mealRows: MealRow[]): Map<string, MealRow[]> {
  const dayMap = new Map<string, MealRow[]>()
  for (const m of mealRows) {
    const day = toDateOnly(new Date(m.eaten_at))
    const arr = dayMap.get(day) ?? []
    arr.push(m)
    dayMap.set(day, arr)
  }
  return dayMap
}

export function computeMealRhythm(mealRows: MealRow[], sleepLogRows: SleepLogRow[]): MealRhythmStats {
  const mealTypeKeys = Object.keys(mealTypeLabels) as MealTypeKey[]
  const dayMap = groupMealsByDay(mealRows)
  const daysConsidered = dayMap.size

  const byMealType: MealTypeRhythm[] = mealTypeKeys.map((key) => {
    const rows = mealRows.filter((m) => m.meal_type === key)
    const minutes = rows.map((m) => minutesOfDay(m.eaten_at))
    const count = rows.length
    const skippedDays = REGULAR_MEAL_TYPES.includes(key)
      ? Array.from(dayMap.values()).filter((dayRows) => !dayRows.some((m) => m.meal_type === key)).length
      : 0
    if (count === 0) {
      return {
        mealType: key,
        label: mealTypeLabels[key],
        count: 0,
        earliest: null,
        latest: null,
        medianMinutes: null,
        rangeMinutes: null,
        regularity: null,
        skippedDays,
      }
    }
    const earliestMin = Math.min(...minutes)
    const latestMin = Math.max(...minutes)
    const rangeMinutes = latestMin - earliestMin
    const regularity: MealTypeRhythm['regularity'] =
      count < 2 ? null : rangeMinutes <= 60 ? 'regelmäßig' : rangeMinutes <= 150 ? 'unregelmäßig' : 'sehr unregelmäßig'
    return {
      mealType: key,
      label: mealTypeLabels[key],
      count,
      earliest: formatMinutes(earliestMin),
      latest: formatMinutes(latestMin),
      medianMinutes: median(minutes),
      rangeMinutes,
      regularity,
      skippedDays,
    }
  })

  let longestGapHours: number | null = null
  for (const dayRows of dayMap.values()) {
    const sorted = [...dayRows].sort((a, b) => new Date(a.eaten_at).getTime() - new Date(b.eaten_at).getTime())
    for (let i = 1; i < sorted.length; i++) {
      const gapHours = (new Date(sorted[i].eaten_at).getTime() - new Date(sorted[i - 1].eaten_at).getTime()) / 3600000
      if (longestGapHours === null || gapHours > longestGapHours) longestGapHours = gapHours
    }
  }

  const lastMealToBedtimeGaps: number[] = []
  for (const log of sleepLogRows) {
    if (!log.bed_at) continue
    const dayRows = dayMap.get(log.night_of)
    if (!dayRows || dayRows.length === 0) continue
    const lastMeal = dayRows.reduce((latest, m) => (new Date(m.eaten_at) > new Date(latest.eaten_at) ? m : latest))
    const gapMinutes = (new Date(log.bed_at).getTime() - new Date(lastMeal.eaten_at).getTime()) / 60000
    if (gapMinutes > 0 && gapMinutes < 16 * 60) lastMealToBedtimeGaps.push(gapMinutes)
  }
  const avgLastMealToBedtimeMinutes = lastMealToBedtimeGaps.length
    ? Math.round(lastMealToBedtimeGaps.reduce((a, b) => a + b, 0) / lastMealToBedtimeGaps.length)
    : null

  return {
    byMealType,
    longestGapHours: longestGapHours !== null ? Math.round(longestGapHours * 10) / 10 : null,
    avgLastMealToBedtimeMinutes,
    lastMealToBedtimeCases: lastMealToBedtimeGaps.length,
    daysConsidered,
  }
}

export type SleepDurationStats = {
  avgDurationHours: number | null
  durationCases: number
  avgQuality: number | null
  qualityCases: number
}

export function computeSleepDuration(sleepLogRows: SleepLogRow[]): SleepDurationStats {
  const durations: number[] = []
  for (const log of sleepLogRows) {
    const start = log.fell_asleep_at ?? log.bed_at
    if (!start || !log.woke_at) continue
    const hours = (new Date(log.woke_at).getTime() - new Date(start).getTime()) / 3600000
    if (hours >= 1 && hours <= 16) durations.push(hours)
  }
  const avgDurationHours = durations.length
    ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    : null
  const qualities = sleepLogRows.map((log) => log.quality).filter((q): q is number => q !== null)
  const avgQuality = qualities.length ? Math.round((qualities.reduce((a, b) => a + b, 0) / qualities.length) * 10) / 10 : null
  return { avgDurationHours, durationCases: durations.length, avgQuality, qualityCases: qualities.length }
}
