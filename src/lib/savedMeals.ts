import type { Database } from './database.types'
import { supabase } from './supabaseClient'

export type SavedMealRow = Database['public']['Tables']['saved_meals']['Row']
export type SavedMealInsert = Database['public']['Tables']['saved_meals']['Insert']
export type SavedMealUpdate = Database['public']['Tables']['saved_meals']['Update']

export async function fetchSavedMeals(userId: string): Promise<SavedMealRow[]> {
  const { data } = await supabase
    .from('saved_meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function insertSavedMeal(payload: SavedMealInsert): Promise<void> {
  await supabase.from('saved_meals').insert(payload)
}

export async function updateSavedMeal(id: string, payload: SavedMealUpdate): Promise<void> {
  await supabase.from('saved_meals').update(payload).eq('id', id)
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await supabase.from('saved_meals').delete().eq('id', id)
}
