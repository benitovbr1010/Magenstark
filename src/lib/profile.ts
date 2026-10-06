import type { Database } from './database.types'
import { supabase } from './supabaseClient'

export type Profile = Database['public']['Tables']['profiles']['Row']

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data
}

export async function upsertProfile(
  userId: string,
  fields: { name: string | null; symptoms_since: string | null; medications: string | null },
): Promise<void> {
  await supabase.from('profiles').upsert({ id: userId, ...fields }, { onConflict: 'id' })
}

export async function updateThemePreference(userId: string, mode: 'light' | 'dark' | 'system'): Promise<void> {
  await supabase.from('profiles').upsert({ id: userId, theme_preference: mode }, { onConflict: 'id' })
}

export async function updateSleepOffsetMinutes(userId: string, minutes: number): Promise<void> {
  await supabase.from('profiles').upsert({ id: userId, sleep_offset_minutes: minutes }, { onConflict: 'id' })
}

export async function updateMorningCheckAfterMinutes(userId: string, minutes: number): Promise<void> {
  await supabase.from('profiles').upsert({ id: userId, morning_check_after_minutes: minutes }, { onConflict: 'id' })
}

export async function updateComplaintThresholds(
  userId: string,
  fields: Partial<{ complaint_symptom_min: number; complaint_bristol_min: number; complaint_window_hours: number }>,
): Promise<void> {
  await supabase.from('profiles').upsert({ id: userId, ...fields }, { onConflict: 'id' })
}
