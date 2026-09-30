import { pdf } from '@react-pdf/renderer'
import { useEffect, useState } from 'react'
import { DoctorReportDocument } from '../lib/DoctorReportDocument'
import { endOfDay, startOfDay, toDateOnly } from '../lib/datetime'
import { fetchProfile, upsertProfile } from '../lib/profile'
import { fetchReportData } from '../lib/report'
import { ToggleChip } from './ToggleChip'

const rangeOptions = [
  { key: 'week', label: 'Diese Woche', days: 7 },
  { key: 'twoWeeks', label: '2 Wochen', days: 14 },
  { key: 'fourWeeks', label: '4 Wochen', days: 28 },
] as const

export function ReportSheet({
  open,
  onClose,
  userId,
}: {
  open: boolean
  onClose: () => void
  userId: string
}) {
  const [range, setRange] = useState<(typeof rangeOptions)[number]['key']>('week')
  const [name, setName] = useState('')
  const [symptomsSince, setSymptomsSince] = useState('')
  const [medications, setMedications] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchProfile(userId).then((profile) => {
      setName(profile?.name ?? '')
      setSymptomsSince(profile?.symptoms_since ?? '')
      setMedications(profile?.medications ?? '')
    })
  }, [open, userId])

  if (!open) return null

  async function handleGenerate() {
    setGenerating(true)
    await upsertProfile(userId, {
      name: name.trim() || null,
      symptoms_since: symptomsSince || null,
      medications: medications.trim() || null,
    })

    const days = rangeOptions.find((r) => r.key === range)!.days
    const to = endOfDay(new Date())
    const from = startOfDay(new Date())
    from.setDate(from.getDate() - (days - 1))

    const data = await fetchReportData(userId, from, to)
    const blob = await pdf(<DoctorReportDocument data={data} />).toBlob()

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Verlaufsbericht_${toDateOnly(from)}_${toDateOnly(to)}.pdf`
    link.click()
    URL.revokeObjectURL(url)

    setGenerating(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">Arztbericht als PDF</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-text">Zeitraum</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <ToggleChip
                key={option.key}
                label={option.label}
                active={range === option.key}
                onClick={() => setRange(option.key)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-text">Allgemein</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
          />
          <label>
            <span className="text-xs text-text-tertiary">Beschwerden seit</span>
            <input
              type="date"
              value={symptomsSince}
              onChange={(e) => setSymptomsSince(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
          <label>
            <span className="text-xs text-text-tertiary">Aktuelle Medikamente/Supplements</span>
            <textarea
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
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
            onClick={handleGenerate}
            className="flex-1 rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {generating ? 'Erstellen …' : 'PDF erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}
