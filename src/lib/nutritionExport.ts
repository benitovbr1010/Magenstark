// Datenaggregation für den Ernährungstagebuch-Export (PDF + CSV). Folgt dem Muster von report.ts,
// liefert zusätzlich Tag-für-Tag-Gruppierung (days) UND die rohen Einzel-Zeilen (rawRows) für die CSV.
import { bristolLabels, goodMarkerLabels, markerLabels, mealTypeLabels, phaseLabels, symptomLabels } from './constants'
import type { Database } from './database.types'
import { formatGermanDate, formatGermanTime, toDateOnly } from './datetime'
import { computeMealRhythm, computeSleepDuration, type MealRhythmStats, type SleepDurationStats } from './mealRhythm'
import { fetchProfile } from './profile'
import { fetchSleepLogs } from './sleep'
import { supabase } from './supabaseClient'
import { fetchWaterLogs, totalMl, type WaterLogRow } from './water'

type MealRow = Database['public']['Tables']['meals']['Row']
type BowelRow = Database['public']['Tables']['bowel_movements']['Row']
type WellbeingRow = Database['public']['Tables']['wellbeing']['Row']

const symptomKeys = Object.keys(symptomLabels) as (keyof typeof symptomLabels)[]
const markerKeys = Object.keys(markerLabels) as (keyof typeof markerLabels)[]
const goodMarkerKeys = Object.keys(goodMarkerLabels) as (keyof typeof goodMarkerLabels)[]

export type NutritionDayEntry = {
  date: string
  dateLabel: string
  place: string | null
  phase: keyof typeof phaseLabels | null
  meals: {
    time: string
    mealType: string
    summary: string
    ingredients: string[]
    markers: string[]
    goodMarkers: string[]
  }[]
  waterCount: number
  waterMl: number
  bowelMovements: { time: string; bristol: number }[]
  symptomPeaks: { label: string; value: number }[]
  stress: number | null
  sleep: number | null
  hasAnyEntry: boolean
}

export type NutritionExportStats = {
  mealCount: number
  mealsPerDay: number
  topIngredients: [string, number][]
  markerCounts: { label: string; count: number }[]
  goodMarkerCounts: { label: string; count: number }[]
  totalMealsForMarkerShare: number
  avgWaterMlPerDay: number
  mealRhythm: MealRhythmStats
  bowelCount: number
  bowelPerDay: number
  bristolCounts: number[]
  symptomAverages: { label: string; average: number }[]
  sleep: SleepDurationStats
}

export type NutritionExportData = {
  from: Date
  to: Date
  name: string | null
  days: NutritionDayEntry[]
  stats: NutritionExportStats
  rawRows: {
    meals: MealRow[]
    bowel: BowelRow[]
    wellbeing: WellbeingRow[]
    water: WaterLogRow[]
  }
}

function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = []
  const cur = new Date(from)
  cur.setHours(12, 0, 0, 0)
  const end = new Date(to)
  end.setHours(12, 0, 0, 0)
  while (cur.getTime() <= end.getTime()) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export async function fetchNutritionExportData(userId: string, from: Date, to: Date): Promise<NutritionExportData> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const nightFrom = new Date(from.getTime() - 24 * 60 * 60 * 1000)
  const nightTo = new Date(to.getTime() - 24 * 60 * 60 * 1000)

  const [profile, bowelRes, wellbeingRes, mealsRes, dayClosingsRes, waterRows, sleepLogRows] = await Promise.all([
    fetchProfile(userId),
    supabase
      .from('bowel_movements')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', fromIso)
      .lte('occurred_at', toIso),
    supabase.from('wellbeing').select('*').eq('user_id', userId).gte('occurred_at', fromIso).lte('occurred_at', toIso),
    supabase.from('meals').select('*').eq('user_id', userId).gte('eaten_at', fromIso).lte('eaten_at', toIso),
    supabase
      .from('day_closings')
      .select('*')
      .eq('user_id', userId)
      .gte('date', toDateOnly(from))
      .lte('date', toDateOnly(to)),
    fetchWaterLogs(userId, from, to),
    fetchSleepLogs(userId, nightFrom, nightTo),
  ])

  const bowelRows = bowelRes.data ?? []
  const wellbeingRows = wellbeingRes.data ?? []
  const mealRows = mealsRes.data ?? []
  const dayClosingRows = dayClosingsRes.data ?? []

  const days: NutritionDayEntry[] = eachDate(from, to).map((date) => {
    const dateStr = toDateOnly(date)
    const dayMeals = mealRows
      .filter((m) => toDateOnly(new Date(m.eaten_at)) === dateStr)
      .sort((a, b) => new Date(a.eaten_at).getTime() - new Date(b.eaten_at).getTime())
    const dayBowel = bowelRows
      .filter((r) => toDateOnly(new Date(r.occurred_at)) === dateStr)
      .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    const dayWellbeing = wellbeingRows.filter((r) => toDateOnly(new Date(r.occurred_at)) === dateStr)
    const dayWater = waterRows.filter((w) => toDateOnly(new Date(w.drunk_at)) === dateStr)
    const dayClosing = dayClosingRows.find((d) => d.date === dateStr) ?? null
    const nightOfStr = toDateOnly(new Date(date.getTime() - 24 * 60 * 60 * 1000))
    const sleepLog = sleepLogRows.find((s) => s.night_of === nightOfStr) ?? null

    const place =
      dayMeals.find((m) => m.place)?.place ??
      dayBowel.find((r) => r.place)?.place ??
      dayWellbeing.find((r) => r.place)?.place ??
      null
    const phase =
      dayMeals.find((m) => m.phase)?.phase ??
      dayBowel.find((r) => r.phase)?.phase ??
      dayWellbeing.find((r) => r.phase)?.phase ??
      null

    const symptomPeaks = symptomKeys
      .map((key) => ({
        label: symptomLabels[key],
        value: dayWellbeing.length ? Math.max(...dayWellbeing.map((r) => r[key])) : 0,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)

    const hasAnyEntry = dayMeals.length > 0 || dayBowel.length > 0 || dayWellbeing.length > 0 || dayWater.length > 0

    return {
      date: dateStr,
      dateLabel: formatGermanDate(date),
      place,
      phase: phase as keyof typeof phaseLabels | null,
      meals: dayMeals.map((m) => ({
        time: formatGermanTime(new Date(m.eaten_at)),
        mealType: mealTypeLabels[m.meal_type as keyof typeof mealTypeLabels],
        summary: m.summary,
        ingredients: m.ingredients ?? [],
        markers: (m.markers as (keyof typeof markerLabels)[]).map((k) => markerLabels[k]),
        goodMarkers: (m.good_markers as (keyof typeof goodMarkerLabels)[]).map((k) => goodMarkerLabels[k]),
      })),
      waterCount: dayWater.length,
      waterMl: totalMl(dayWater),
      bowelMovements: dayBowel.map((r) => ({ time: formatGermanTime(new Date(r.occurred_at)), bristol: r.bristol })),
      symptomPeaks,
      stress: dayClosing?.stress ?? null,
      sleep: sleepLog?.quality ?? null,
      hasAnyEntry,
    }
  })

  const ingredientCounts = new Map<string, number>()
  for (const meal of mealRows) {
    const list = meal.ingredients && meal.ingredients.length > 0 ? meal.ingredients : meal.main_foods
    for (const item of list) {
      ingredientCounts.set(item, (ingredientCounts.get(item) ?? 0) + 1)
    }
  }
  const topIngredients = Array.from(ingredientCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const markerCounts = markerKeys
    .map((key) => ({ label: markerLabels[key], count: mealRows.filter((m) => m.markers.includes(key)).length }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
  const goodMarkerCounts = goodMarkerKeys
    .map((key) => ({ label: goodMarkerLabels[key], count: mealRows.filter((m) => m.good_markers.includes(key)).length }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)

  const numberOfDays = days.length
  const avgWaterMlPerDay = totalMl(waterRows) / numberOfDays

  const mealRhythm = computeMealRhythm(mealRows, sleepLogRows)
  const sleep = computeSleepDuration(sleepLogRows)

  const bristolCounts = [1, 2, 3, 4, 5, 6, 7].map((value) => bowelRows.filter((row) => row.bristol === value).length)

  const symptomAverages = symptomKeys.map((key) => {
    const values = wellbeingRows.map((row) => row[key])
    const average = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
    return { label: symptomLabels[key], average: Math.round(average * 10) / 10 }
  })

  return {
    from,
    to,
    name: profile?.name ?? null,
    days,
    stats: {
      mealCount: mealRows.length,
      mealsPerDay: Math.round((mealRows.length / numberOfDays) * 10) / 10,
      topIngredients,
      markerCounts,
      goodMarkerCounts,
      totalMealsForMarkerShare: mealRows.length,
      avgWaterMlPerDay,
      mealRhythm,
      bowelCount: bowelRows.length,
      bowelPerDay: Math.round((bowelRows.length / numberOfDays) * 10) / 10,
      bristolCounts,
      symptomAverages,
      sleep,
    },
    rawRows: {
      meals: mealRows,
      bowel: bowelRows,
      wellbeing: wellbeingRows,
      water: waterRows,
    },
  }
}

function csvEscape(value: string): string {
  const needsQuoting = /[";\n]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuoting ? `"${escaped}"` : escaped
}

export function buildNutritionCsv(data: NutritionExportData): string {
  const columns = [
    'Datum',
    'Uhrzeit',
    'Art',
    'Beschreibung',
    'Zutaten',
    'Auslöser-Marker',
    'Gute Marker',
    'Bristol-Typ',
    'Beschwerden',
    'Ort',
    'Phase',
  ]

  type CsvRow = { fields: Record<(typeof columns)[number], string>; sortKey: number }
  const rows: CsvRow[] = []

  for (const m of data.rawRows.meals) {
    const time = new Date(m.eaten_at)
    rows.push({
      fields: {
        Datum: toDateOnly(time),
        Uhrzeit: formatGermanTime(time),
        Art: 'Mahlzeit',
        Beschreibung: `${mealTypeLabels[m.meal_type as keyof typeof mealTypeLabels]}: ${m.summary}`,
        Zutaten: (m.ingredients && m.ingredients.length > 0 ? m.ingredients : m.main_foods).join(', '),
        'Auslöser-Marker': (m.markers as (keyof typeof markerLabels)[]).map((k) => markerLabels[k]).join(', '),
        'Gute Marker': (m.good_markers as (keyof typeof goodMarkerLabels)[]).map((k) => goodMarkerLabels[k]).join(', '),
        'Bristol-Typ': '',
        Beschwerden: '',
        Ort: m.place ?? '',
        Phase: m.phase ? phaseLabels[m.phase as keyof typeof phaseLabels] : '',
      },
      sortKey: time.getTime(),
    })
  }

  for (const b of data.rawRows.bowel) {
    const time = new Date(b.occurred_at)
    rows.push({
      fields: {
        Datum: toDateOnly(time),
        Uhrzeit: formatGermanTime(time),
        Art: 'Toilette',
        Beschreibung: `Typ ${b.bristol} · ${bristolLabels[b.bristol as 1 | 2 | 3 | 4 | 5 | 6 | 7]}`,
        Zutaten: '',
        'Auslöser-Marker': '',
        'Gute Marker': '',
        'Bristol-Typ': String(b.bristol),
        Beschwerden: '',
        Ort: b.place ?? '',
        Phase: b.phase ? phaseLabels[b.phase as keyof typeof phaseLabels] : '',
      },
      sortKey: time.getTime(),
    })
  }

  for (const w of data.rawRows.wellbeing) {
    const time = new Date(w.occurred_at)
    const symptomTexts = symptomKeys.map((key) => `${symptomLabels[key]} ${w[key]}`).join(', ')
    rows.push({
      fields: {
        Datum: toDateOnly(time),
        Uhrzeit: formatGermanTime(time),
        Art: 'Befinden',
        Beschreibung: 'Befinden erfasst',
        Zutaten: '',
        'Auslöser-Marker': '',
        'Gute Marker': '',
        'Bristol-Typ': '',
        Beschwerden: symptomTexts,
        Ort: w.place ?? '',
        Phase: w.phase ? phaseLabels[w.phase as keyof typeof phaseLabels] : '',
      },
      sortKey: time.getTime(),
    })
  }

  for (const w of data.rawRows.water) {
    const time = new Date(w.drunk_at)
    rows.push({
      fields: {
        Datum: toDateOnly(time),
        Uhrzeit: formatGermanTime(time),
        Art: 'Wasser',
        Beschreibung: `${w.amount_ml} ml getrunken`,
        Zutaten: '',
        'Auslöser-Marker': '',
        'Gute Marker': '',
        'Bristol-Typ': '',
        Beschwerden: '',
        Ort: '',
        Phase: '',
      },
      sortKey: time.getTime(),
    })
  }

  rows.sort((a, b) => a.sortKey - b.sortKey)

  const lines = [columns.join(';')]
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row.fields[col])).join(';'))
  }
  return '\uFEFF' + lines.join('\n')
}
