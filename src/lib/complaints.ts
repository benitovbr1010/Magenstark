// Zentrale Definition von "signifikanter Beschwerde" (Wochenübersicht-Überarbeitung).
// Vorher zählte jeder Befinden-Eintrag mit irgendeinem Wert > 0 als Beschwerde – bei einem
// 24h-Fenster traf das fast immer zu. Jetzt feste, in den Einstellungen anpassbare Schwellen,
// die überall in der Wochenübersicht (Zusammenhänge, Schlimmste Momente, Nach Ort) einheitlich
// genutzt werden.
import { bristolLabels, symptomLabels, describeStrongestSymptom } from './constants'
import type { Database } from './database.types'

type BowelRow = Database['public']['Tables']['bowel_movements']['Row']
type WellbeingRow = Database['public']['Tables']['wellbeing']['Row']

export type ComplaintThresholds = {
  symptomMin: number
  bristolMin: number
  urgencyMin: number
  windowHours: number
}

export const DEFAULT_COMPLAINT_THRESHOLDS: ComplaintThresholds = {
  symptomMin: 5,
  bristolMin: 6,
  urgencyMin: 2,
  windowHours: 8,
}

/** Mindestabstand nach einer Mahlzeit, ab dem ein Eintrag als Reaktion auf sie zählt (fest, nicht einstellbar). */
export const COMPLAINT_WINDOW_START_HOURS = 1

/** Die Befinden-Werte, die als Beschwerde zählen können. Stress/Rumpeln bewusst ausgeschlossen –
 * das sind Begleitumstände, keine Beschwerden selbst. */
export const complaintSymptomKeys = ['abdominal_pain', 'bloating', 'nausea', 'fullness', 'urgency', 'heartburn'] as const

export function isSignificantWellbeing(row: WellbeingRow, t: ComplaintThresholds): boolean {
  return complaintSymptomKeys.some((key) => row[key] >= t.symptomMin)
}

export function isSignificantBowel(row: BowelRow, t: ComplaintThresholds): boolean {
  return row.bristol >= t.bristolMin || row.urgency >= t.urgencyMin || row.pain
}

/** Stärke 0–10 für die Sortierung, nur unter den relevanten Befinden-Werten. */
export function wellbeingSeverity(row: WellbeingRow): number {
  return Math.max(...complaintSymptomKeys.map((key) => row[key]))
}

/** Stärke 0–10 für einen Toilettengang, aus Bristol/Dringlichkeit/Schmerzen abgeleitet. */
export function bowelSeverity(row: BowelRow): number {
  const bristolSeverity = row.bristol === 7 ? 10 : row.bristol === 6 ? 7 : 0
  const urgencySeverity = row.urgency === 2 ? 8 : row.urgency === 1 ? 3 : 0
  const painSeverity = row.pain ? 9 : 0
  return Math.max(bristolSeverity, urgencySeverity, painSeverity)
}

export function describeWellbeingComplaint(row: WellbeingRow): string {
  return describeStrongestSymptom(row as unknown as Record<keyof typeof symptomLabels, number>, [...complaintSymptomKeys])
}

export function describeBowelComplaint(row: BowelRow): string {
  const parts: string[] = []
  if (row.bristol >= 6) parts.push(`Bristol ${row.bristol} (${bristolLabels[row.bristol as 1 | 2 | 3 | 4 | 5 | 6 | 7]})`)
  if (row.urgency === 2) parts.push('starker Stuhldrang')
  if (row.pain) parts.push('Schmerzen')
  return parts.length ? parts.join(', ') : 'Auffälliger Stuhlgang'
}

export type ComplaintEvent = {
  id: string
  type: 'bowel' | 'wellbeing'
  time: string
  severity: number
  label: string
  place: string | null
}

/** Alle signifikanten Beschwerde-Ereignisse aus Toilette+Befinden, nach Stärke absteigend sortiert. */
export function collectComplaintEvents(
  bowelRows: BowelRow[],
  wellbeingRows: WellbeingRow[],
  t: ComplaintThresholds,
): ComplaintEvent[] {
  const events: ComplaintEvent[] = []
  for (const r of bowelRows) {
    if (!isSignificantBowel(r, t)) continue
    events.push({ id: r.id, type: 'bowel', time: r.occurred_at, severity: bowelSeverity(r), label: describeBowelComplaint(r), place: r.place })
  }
  for (const r of wellbeingRows) {
    if (!isSignificantWellbeing(r, t)) continue
    events.push({
      id: r.id,
      type: 'wellbeing',
      time: r.occurred_at,
      severity: wellbeingSeverity(r),
      label: describeWellbeingComplaint(r),
      place: r.place,
    })
  }
  return events.sort((a, b) => b.severity - a.severity || new Date(b.time).getTime() - new Date(a.time).getTime())
}
