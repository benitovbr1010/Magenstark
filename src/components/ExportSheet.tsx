import { pdf } from '@react-pdf/renderer'
import { useState } from 'react'
import { endOfDay, startOfDay, toDateOnly } from '../lib/datetime'
import { buildNutritionCsv, fetchNutritionExportData } from '../lib/nutritionExport'
import { NutritionDiaryDocument } from '../lib/NutritionDiaryDocument'
import { ToggleChip } from './ToggleChip'

const periodOptions = [
  { key: 'week', label: '7 Tage', days: 7 },
  { key: 'twoWeeks', label: '14 Tage', days: 14 },
  { key: 'month', label: '30 Tage', days: 30 },
  { key: 'custom', label: 'Eigener Zeitraum', days: null },
] as const

const formatOptions = [
  { key: 'pdf', label: 'PDF' },
  { key: 'csv', label: 'CSV' },
] as const

async function shareOrDownload(blob: Blob, filename: string, mimeType: string) {
  const file = new File([blob], filename, { type: mimeType })
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch {
      // Nutzer hat geteilt-Dialog abgebrochen oder Share fehlgeschlagen → Fallback auf Download
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function ExportSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [period, setPeriod] = useState<(typeof periodOptions)[number]['key']>('week')
  const [format, setFormat] = useState<(typeof formatOptions)[number]['key']>('pdf')
  const [customFrom, setCustomFrom] = useState(toDateOnly(new Date()))
  const [customTo, setCustomTo] = useState(toDateOnly(new Date()))
  const [generating, setGenerating] = useState(false)

  if (!open) return null

  async function handleExport() {
    setGenerating(true)
    let from: Date
    let to: Date
    if (period === 'custom') {
      from = startOfDay(new Date(`${customFrom}T12:00:00`))
      to = endOfDay(new Date(`${customTo}T12:00:00`))
    } else {
      const days = periodOptions.find((p) => p.key === period)!.days!
      to = endOfDay(new Date())
      from = startOfDay(new Date())
      from.setDate(from.getDate() - (days - 1))
    }

    const data = await fetchNutritionExportData(userId, from, to)
    const filenameBase = `Ernaehrungstagebuch_${toDateOnly(from)}_${toDateOnly(to)}`

    if (format === 'pdf') {
      const blob = await pdf(<NutritionDiaryDocument data={data} />).toBlob()
      await shareOrDownload(blob, `${filenameBase}.pdf`, 'application/pdf')
    } else {
      const csv = buildNutritionCsv(data)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      await shareOrDownload(blob, `${filenameBase}.csv`, 'text/csv')
    }

    setGenerating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">Ernährungstagebuch exportieren</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Zeitraum</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <ToggleChip
                key={option.key}
                label={option.label}
                active={period === option.key}
                onClick={() => setPeriod(option.key)}
              />
            ))}
          </div>
          {period === 'custom' && (
            <div className="mt-3 flex gap-3">
              <label className="flex-1">
                <span className="text-xs text-text-tertiary">Von</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                />
              </label>
              <label className="flex-1">
                <span className="text-xs text-text-tertiary">Bis</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Format</p>
          <div className="mt-2 flex gap-2">
            {formatOptions.map((option) => (
              <ToggleChip
                key={option.key}
                label={option.label}
                active={format === option.key}
                onClick={() => setFormat(option.key)}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-border px-4 py-3 font-medium text-text-secondary"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleExport}
            className="flex-1 rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {generating ? 'Erstellen …' : 'Exportieren'}
          </button>
        </div>
      </div>
    </div>
  )
}
