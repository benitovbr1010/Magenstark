import { useEffect, useState } from 'react'
import { createExamination, fetchExaminations, type ExaminationRow } from '../lib/examinations'
import { toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'

export function UploadSheet({
  open,
  onClose,
  userId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  userId: string
  onSaved: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [docDate, setDocDate] = useState(toDateOnly(new Date()))
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [examinations, setExaminations] = useState<ExaminationRow[]>([])
  const [examinationChoice, setExaminationChoice] = useState<'none' | 'new' | string>('none')
  const [newExaminationTitle, setNewExaminationTitle] = useState('')

  useEffect(() => {
    if (!open) return
    fetchExaminations(userId).then(setExaminations)
  }, [open, userId])

  if (!open) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    setFiles(selected)
    if (selected[0] && !title) {
      setTitle(selected[0].name.replace(/\.[^.]+$/, ''))
    }
  }

  async function handleSave() {
    if (files.length === 0 || !title.trim()) return
    setSaving(true)
    setError(null)

    let examinationId: string | null = null
    if (examinationChoice === 'new') {
      if (newExaminationTitle.trim()) {
        const exam = await createExamination(userId, newExaminationTitle)
        examinationId = exam?.id ?? null
      }
    } else if (examinationChoice !== 'none') {
      examinationId = examinationChoice
    }

    const paths: string[] = []
    for (const file of files) {
      const path = `${userId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
      if (uploadError) {
        setError('Upload fehlgeschlagen. Bitte erneut versuchen.')
        setSaving(false)
        return
      }
      paths.push(path)
    }

    const { error: insertError } = await supabase.from('documents').insert({
      user_id: userId,
      title: title.trim(),
      doc_date: docDate || null,
      source: source.trim() || null,
      file_path: paths[0],
      file_paths: paths,
      examination_id: examinationId,
    })

    setSaving(false)
    if (insertError) {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
      return
    }
    onSaved()
    onClose()
    setFiles([])
    setTitle('')
    setSource('')
    setExaminationChoice('none')
    setNewExaminationTitle('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">Dokument hochladen</h2>

        <div className="mt-4 flex flex-col gap-3">
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            onChange={handleFileChange}
            className="text-sm text-text"
          />
          {files.length > 1 && (
            <p className="text-xs text-text-tertiary">{files.length} Dateien ausgewählt</p>
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
          />
          <label>
            <span className="text-xs text-text-tertiary">Datum</span>
            <input
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Quelle, z. B. Hausarzt"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
          />

          <label>
            <span className="text-xs text-text-tertiary">Gehört zu einer Untersuchung?</span>
            <select
              value={examinationChoice}
              onChange={(e) => setExaminationChoice(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
            >
              <option value="none">Keine</option>
              {examinations.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
              <option value="new">+ Neue Untersuchung anlegen</option>
            </select>
          </label>
          {examinationChoice === 'new' && (
            <input
              value={newExaminationTitle}
              onChange={(e) => setNewExaminationTitle(e.target.value)}
              placeholder="Name der Untersuchung, z. B. Magenspiegelung Mai 2024"
              className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
            />
          )}
        </div>

        {error && <p className="mt-2 text-sm text-warning">{error}</p>}

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
            disabled={files.length === 0 || !title.trim() || saving}
            onClick={handleSave}
            className="flex-1 rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Hochladen …' : 'Hochladen'}
          </button>
        </div>
      </div>
    </div>
  )
}
