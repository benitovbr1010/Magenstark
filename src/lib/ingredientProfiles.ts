// Zutaten-Wissensbasis: Marker einer Mahlzeit werden nie dauerhaft als "wahr" aus den gespeicherten
// meals.markers-Spalten übernommen, sondern bei Bedarf live aus meals.ingredients + dem aktuellen
// Stand von ingredient_profiles berechnet. So wirken Korrekturen an einer Zutat rückwirkend auf alle
// Mahlzeiten, die diese Zutat enthalten (SPEC-Erweiterung: "Zutaten-Bewertungen" + Konsistenz-Fix).
import type { Database } from './database.types'
import { supabase } from './supabaseClient'

export type IngredientProfileRow = Database['public']['Tables']['ingredient_profiles']['Row']

export const fodmapTypeLabels = {
  fruktane: 'Fruktane',
  laktose: 'Laktose',
  fruktose: 'Fruktose',
  polyole: 'Polyole',
  gos: 'GOS',
} as const

export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function fetchIngredientProfiles(names: string[]): Promise<Record<string, IngredientProfileRow>> {
  const unique = Array.from(new Set(names.map(normalizeIngredientName))).filter(Boolean)
  if (unique.length === 0) return {}
  const { data } = await supabase.from('ingredient_profiles').select('*').in('name', unique)
  const map: Record<string, IngredientProfileRow> = {}
  for (const row of data ?? []) map[row.name] = row
  return map
}

export async function fetchAllIngredientProfiles(): Promise<IngredientProfileRow[]> {
  const { data } = await supabase.from('ingredient_profiles').select('*').order('name', { ascending: true })
  return data ?? []
}

export async function updateIngredientProfile(
  id: string,
  payload: Partial<Pick<IngredientProfileRow, 'markers' | 'good_markers' | 'fodmap_types' | 'note'>>,
): Promise<void> {
  await supabase
    .from('ingredient_profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export type MealMarkerBreakdown = {
  markers: string[]
  goodMarkers: string[]
  fodmapSources: string[]
  goodFoods: string[]
  markerOrigins: Record<string, string[]>
  goodMarkerOrigins: Record<string, string[]>
  fodmapTypesByIngredient: Record<string, string[]>
}

const PREP_MARKER_LABELS: Record<string, string> = {
  fettig_frittiert: 'Zubereitung',
  scharf: 'Würzung',
}

function addOrigin(map: Record<string, string[]>, key: string, value: string) {
  if (!map[key]) map[key] = []
  if (!map[key].includes(value)) map[key].push(value)
}

/** Berechnet Marker/Good-Marker/FODMAP-Quellen/gute Zutaten einer Mahlzeit live aus ihren Zutaten
 * + dem aktuellen Stand der Zutaten-Profile (statt die beim Speichern eingefrorenen Spalten zu nutzen). */
export function computeMealMarkers(
  ingredients: string[],
  prepMarkers: string[],
  profiles: Record<string, IngredientProfileRow>,
): MealMarkerBreakdown {
  const markerOrigins: Record<string, string[]> = {}
  const goodMarkerOrigins: Record<string, string[]> = {}
  const fodmapTypesByIngredient: Record<string, string[]> = {}
  const fodmapSources: string[] = []
  const goodFoods: string[] = []

  for (const rawName of ingredients) {
    const name = normalizeIngredientName(rawName)
    const profile = profiles[name]
    if (!profile) continue
    for (const m of profile.markers) addOrigin(markerOrigins, m, name)
    for (const g of profile.good_markers) addOrigin(goodMarkerOrigins, g, name)
    if (profile.markers.includes('fodmap_hoch')) {
      fodmapSources.push(name)
      if (profile.fodmap_types.length > 0) fodmapTypesByIngredient[name] = profile.fodmap_types
    }
    if (profile.good_markers.length > 0) goodFoods.push(name)
  }

  for (const p of prepMarkers) addOrigin(markerOrigins, p, PREP_MARKER_LABELS[p] ?? p)

  return {
    markers: Object.keys(markerOrigins),
    goodMarkers: Object.keys(goodMarkerOrigins),
    fodmapSources,
    goodFoods,
    markerOrigins,
    goodMarkerOrigins,
    fodmapTypesByIngredient,
  }
}
