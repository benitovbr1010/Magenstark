import type { Database } from './database.types'
import { supabase } from './supabaseClient'

export type WaterLogRow = Database['public']['Tables']['water_logs']['Row']

export const DEFAULT_WATER_AMOUNT_ML = 250

export async function fetchWaterLogs(userId: string, from: Date, to: Date): Promise<WaterLogRow[]> {
  const { data } = await supabase
    .from('water_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('drunk_at', from.toISOString())
    .lte('drunk_at', to.toISOString())
    .order('drunk_at', { ascending: true })
  return data ?? []
}

export async function addWaterLog(userId: string, drunkAt: Date, amountMl = DEFAULT_WATER_AMOUNT_ML): Promise<void> {
  await supabase.from('water_logs').insert({ user_id: userId, drunk_at: drunkAt.toISOString(), amount_ml: amountMl })
}

export async function removeWaterLog(id: string): Promise<void> {
  await supabase.from('water_logs').delete().eq('id', id)
}

export function totalMl(logs: WaterLogRow[]): number {
  return logs.reduce((sum, log) => sum + log.amount_ml, 0)
}

export function formatLiters(ml: number): string {
  return `${(ml / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} l`
}
