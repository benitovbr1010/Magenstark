// Untersuchungen: Gruppen von Dokumenten (Befund + Pathologie + Arztbrief derselben Untersuchung),
// die beim Hochladen zugeordnet und gemeinsam ausgewertet werden können.
import type { Database } from './database.types'
import { supabase } from './supabaseClient'

export type ExaminationRow = Database['public']['Tables']['examinations']['Row']

export async function fetchExaminations(userId: string): Promise<ExaminationRow[]> {
  const { data } = await supabase
    .from('examinations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createExamination(userId: string, title: string): Promise<ExaminationRow | null> {
  const { data } = await supabase
    .from('examinations')
    .insert({ user_id: userId, title: title.trim() })
    .select()
    .single()
  return data ?? null
}
