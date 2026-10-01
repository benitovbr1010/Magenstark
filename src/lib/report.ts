import { flagLabels, symptomLabels } from './constants'
import { toDateOnly } from './datetime'
import type { Profile } from './profile'
import { supabase } from './supabaseClient'
import { fetchWaterLogs, totalMl } from './water'

type FlagKey = keyof typeof flagLabels

export type ReportData = {
  from: Date
  to: Date
  profile: Profile | null
  symptomAverages: { label: string; average: number }[]
  bowelCount: number
  bristolCounts: number[]
  flagCounts: { label: string; count: number }[]
  mealCount: number
  topFoods: [string, number][]
  markerShare: { label: string; percent: number }[]
  placeDays: { place: string; days: number }[]
  avgStress: number | null
  avgSleep: number | null
  avgWaterMlPerDay: number
  documents: { title: string; docDate: string | null; summary: string | null }[]
  savedQuestions: string[]
}

const flagKeys = Object.keys(flagLabels) as FlagKey[]

const markerDefs: { key: 'gluten' | 'laktose' | 'fodmap_hoch'; label: string }[] = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'laktose', label: 'Laktose' },
  { key: 'fodmap_hoch', label: 'FODMAP hoch' },
]

export async function fetchReportData(userId: string, from: Date, to: Date): Promise<ReportData> {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()
  const dateFrom = toDateOnly(from)
  const dateTo = toDateOnly(to)

  const [profileRes, bowelRes, wellbeingRes, mealsRes, dayClosingsRes, documentsRes, questionsRes, waterRows] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('bowel_movements')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', fromIso)
      .lte('occurred_at', toIso),
    supabase.from('wellbeing').select('*').eq('user_id', userId).gte('occurred_at', fromIso).lte('occurred_at', toIso),
    supabase.from('meals').select('*').eq('user_id', userId).gte('eaten_at', fromIso).lte('eaten_at', toIso),
    supabase.from('day_closings').select('*').eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo),
    supabase
      .from('documents')
      .select('title, doc_date, analysis')
      .eq('user_id', userId)
      .order('doc_date', { ascending: false })
      .limit(5),
    supabase.from('doctor_questions').select('text').eq('user_id', userId).eq('saved', true),
    fetchWaterLogs(userId, from, to),
  ])

  const bowelRows = bowelRes.data ?? []
  const wellbeingRows = wellbeingRes.data ?? []
  const mealRows = mealsRes.data ?? []
  const dayClosingRows = dayClosingsRes.data ?? []

  const symptomKeys = Object.keys(symptomLabels) as (keyof typeof symptomLabels)[]
  const symptomAverages = symptomKeys.map((key) => {
    const values = wellbeingRows.map((row) => row[key])
    const average = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
    return { label: symptomLabels[key], average: Math.round(average * 10) / 10 }
  })

  const bristolCounts = [1, 2, 3, 4, 5, 6, 7].map((value) => bowelRows.filter((row) => row.bristol === value).length)
  const flagCounts = [
    ...flagKeys.map((key) => ({
      label: flagLabels[key],
      count: bowelRows.filter((row) => Boolean(row[key])).length,
    })),
    { label: 'Dringend', count: bowelRows.filter((row) => row.urgency > 0).length },
  ]

  const foodCounts = new Map<string, number>()
  for (const meal of mealRows) {
    for (const food of meal.main_foods) {
      foodCounts.set(food, (foodCounts.get(food) ?? 0) + 1)
    }
  }
  const topFoods = Array.from(foodCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const markerShare = markerDefs.map(({ key, label }) => ({
    label,
    percent: mealRows.length
      ? Math.round((mealRows.filter((meal) => meal.markers.includes(key)).length / mealRows.length) * 100)
      : 0,
  }))

  const placeDaySets = new Map<string, Set<string>>()
  for (const row of bowelRows) {
    if (!row.place) continue
    const dateStr = toDateOnly(new Date(row.occurred_at))
    if (!placeDaySets.has(row.place)) placeDaySets.set(row.place, new Set())
    placeDaySets.get(row.place)!.add(dateStr)
  }
  for (const row of wellbeingRows) {
    if (!row.place) continue
    const dateStr = toDateOnly(new Date(row.occurred_at))
    if (!placeDaySets.has(row.place)) placeDaySets.set(row.place, new Set())
    placeDaySets.get(row.place)!.add(dateStr)
  }
  for (const row of mealRows) {
    if (!row.place) continue
    const dateStr = toDateOnly(new Date(row.eaten_at))
    if (!placeDaySets.has(row.place)) placeDaySets.set(row.place, new Set())
    placeDaySets.get(row.place)!.add(dateStr)
  }
  const placeDays = Array.from(placeDaySets.entries())
    .map(([place, days]) => ({ place, days: days.size }))
    .sort((a, b) => b.days - a.days)

  const avgStress = dayClosingRows.length
    ? Math.round((dayClosingRows.reduce((sum, row) => sum + row.stress, 0) / dayClosingRows.length) * 10) / 10
    : null
  const avgSleep = dayClosingRows.length
    ? Math.round((dayClosingRows.reduce((sum, row) => sum + row.sleep, 0) / dayClosingRows.length) * 10) / 10
    : null

  const documents = (documentsRes.data ?? []).map((doc) => ({
    title: doc.title,
    docDate: doc.doc_date,
    summary: (doc.analysis as { summary?: string } | null)?.summary ?? null,
  }))
  const savedQuestions = (questionsRes.data ?? []).map((q) => q.text)

  const numberOfDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1)
  const avgWaterMlPerDay = totalMl(waterRows) / numberOfDays

  return {
    from,
    to,
    profile: profileRes.data ?? null,
    symptomAverages,
    bowelCount: bowelRows.length,
    bristolCounts,
    flagCounts,
    mealCount: mealRows.length,
    topFoods,
    markerShare,
    placeDays,
    avgStress,
    avgSleep,
    avgWaterMlPerDay,
    documents,
    savedQuestions,
  }
}
