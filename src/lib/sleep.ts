import type { Database } from './database.types'
import { supabase } from './supabaseClient'
import { toDateOnly } from './datetime'

export type SleepLogRow = Database['public']['Tables']['sleep_logs']['Row']

export const DEFAULT_SLEEP_OFFSET_MINUTES = 15

export async function fetchSleepLog(userId: string, nightOf: Date): Promise<SleepLogRow | null> {
  const { data } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('night_of', toDateOnly(nightOf))
    .maybeSingle()
  return data
}

export async function fetchSleepLogs(userId: string, from: Date, to: Date): Promise<SleepLogRow[]> {
  const { data } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('night_of', toDateOnly(from))
    .lte('night_of', toDateOnly(to))
    .order('night_of', { ascending: true })
  return data ?? []
}

export async function upsertSleepLog(
  userId: string,
  nightOf: Date,
  fields: Partial<{
    bed_at: string | null
    fell_asleep_at: string | null
    woke_at: string | null
    quality: number | null
    note: string | null
  }>,
): Promise<void> {
  await supabase
    .from('sleep_logs')
    .upsert({ user_id: userId, night_of: toDateOnly(nightOf), ...fields }, { onConflict: 'user_id,night_of' })
}

export function computeFellAsleepAt(bedAt: Date, offsetMinutes: number): Date {
  return new Date(bedAt.getTime() + offsetMinutes * 60_000)
}

export function sleepDurationMinutes(
  log: Pick<SleepLogRow, 'bed_at' | 'woke_at'> & Partial<Pick<SleepLogRow, 'fell_asleep_at'>>,
): number | null {
  const start = log.fell_asleep_at ?? log.bed_at
  if (!start || !log.woke_at) return null
  const minutes = (new Date(log.woke_at).getTime() - new Date(start).getTime()) / 60_000
  return minutes > 0 ? Math.round(minutes) : null
}

/** Plausibilitätsprüfung: Schlafdauer unter 1 Std. oder über 16 Std. ist wahrscheinlich ein Zeiten-Fehler. */
export function isPlausibleSleepDuration(minutes: number): boolean {
  return minutes >= 60 && minutes <= 16 * 60
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h} Std`
  return `${h} Std ${m} Min`
}
