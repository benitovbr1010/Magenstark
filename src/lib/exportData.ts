import { supabase } from './supabaseClient'

const USER_ID_TABLES = [
  'contexts',
  'meals',
  'bowel_movements',
  'wellbeing',
  'day_closings',
  'steps',
  'documents',
  'doctor_questions',
] as const

export type ExportData = Record<string, Record<string, unknown>[]>

export async function fetchAllUserData(userId: string): Promise<ExportData> {
  const [profileRes, ...results] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId),
    ...USER_ID_TABLES.map((table) => supabase.from(table).select('*').eq('user_id', userId)),
  ])
  const data: ExportData = { profiles: (profileRes.data as Record<string, unknown>[]) ?? [] }
  USER_ID_TABLES.forEach((table, i) => {
    data[table] = (results[i].data as Record<string, unknown>[]) ?? []
  })

  const documentIds = data.documents.map((doc) => doc.id as string)
  const chatsRes = documentIds.length
    ? await supabase.from('document_chats').select('*').in('document_id', documentIds)
    : { data: [] }
  data.document_chats = (chatsRes.data as Record<string, unknown>[]) ?? []

  return data
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportAsJson(data: ExportData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `verdauungstagebuch_export_${Date.now()}.json`)
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const columns = Object.keys(rows[0])
  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(','))
  }
  return lines.join('\n')
}

export function exportAsCsv(data: ExportData) {
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue
    const blob = new Blob([toCsv(rows)], { type: 'text/csv' })
    downloadBlob(blob, `${table}.csv`)
  }
}
