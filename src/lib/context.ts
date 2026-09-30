import { toDateOnly } from './datetime'
import { supabase } from './supabaseClient'

export type ActiveContext = {
  id: string
  place: string
  phase: 'alltag' | 'urlaub' | 'krank'
  start_date: string
  end_date: string | null
}

/** Der zuletzt begonnene Kontext, unabhängig davon ob sein Zeitraum schon abgelaufen ist. */
export async function fetchLatestContext(userId: string): Promise<ActiveContext | null> {
  const { data } = await supabase
    .from('contexts')
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as ActiveContext | null
}

export function isContextExpired(context: ActiveContext, today = new Date()): boolean {
  if (!context.end_date) return false
  return context.end_date < toDateOnly(today)
}

export async function fetchKnownPlaces(userId: string): Promise<string[]> {
  const { data } = await supabase.from('contexts').select('place').eq('user_id', userId)
  const places = new Set((data ?? []).map((row) => row.place))
  return Array.from(places)
}
