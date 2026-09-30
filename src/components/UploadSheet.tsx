import { useState } from 'react'
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
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [docDate, setDocDate] = useState(toDateOnly(new Date()))
  const [source, setSource] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    if (selected && !title) {
      setTitle(selected.name.replace(/\.[^.]+$/, ''))
    }
  }

  async function handleSave() {
    if (!file || !title.trim()) return
    setSaving(true)
    setError(null)

    const path = `${userId}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) {
      setError('Upload fehlgeschlagen. Bitte erneut versuchen.')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('documents').insert({
      user_id: userId,
      title: title.trim(),
      doc_date: docDate || null,
      source: source.trim() || null,
      file_path: path,
    })

    setSaving(false)
    if (insertError) {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
      return
    }
    onSaved()
    onClose()
    setFile(null)
    setTitle('')
    setSource('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-5">
        <h2 className="text-xl font-semibold text-text">Dokument hochladen</h2>

        <div className="mt-4 flex flex-col gap-3">
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={handleFileChange}
            className="text-sm text-text"
          />
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
            disabled={!file || !title.trim() || saving}
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
