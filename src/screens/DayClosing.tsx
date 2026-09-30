import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToggleChip } from '../components/ToggleChip'
import { useAuth } from '../lib/AuthContext'
import { dayTagLabels } from '../lib/constants'
import { formatGermanDate, toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'

const tagKeys = Object.keys(dayTagLabels) as (keyof typeof dayTagLabels)[]
const levels = [1, 2, 3, 4, 5] as const

function RatingDots({ value, onChange }: { value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <div className="flex gap-3">
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          aria-label={`Stufe ${level}`}
          onClick={() => onChange(level)}
          className={`h-8 w-8 rounded-full border ${
            value >= level ? 'border-primary bg-primary' : 'border-border bg-card'
          }`}
        />
      ))}
    </div>
  )
}

export function DayClosing() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const today = new Date()

  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [sleep, setSleep] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [tags, setTags] = useState<(keyof typeof dayTagLabels)[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    supabase
      .from('day_closings')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('date', toDateOnly(today))
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStress(data.stress as 1 | 2 | 3 | 4 | 5)
          setSleep(data.sleep as 1 | 2 | 3 | 4 | 5)
          setTags(data.tags as (keyof typeof dayTagLabels)[])
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  function toggleTag(key: keyof typeof dayTagLabels) {
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  async function handleSave() {
    if (!session) return
    setSaving(true)
    const { error } = await supabase.from('day_closings').upsert(
      {
        user_id: session.user.id,
        date: toDateOnly(today),
        stress,
        sleep,
        tags,
        note: note.trim() || null,
      },
      { onConflict: 'user_id,date' },
    )
    setSaving(false)
    if (!error) {
      navigate('/')
    }
  }

  if (loading) {
    return null
  }

  return (
    <div className="pb-10">
      <ScreenHeader title="Wie war dein Tag?" subtitle={formatGermanDate(today)} />

      <div className="mt-6 flex flex-col gap-6 px-4">
        <div>
          <p className="text-sm font-medium text-text">Stress heute</p>
          <div className="mt-2">
            <RatingDots value={stress} onChange={setStress} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-text-tertiary" style={{ maxWidth: '9.5rem' }}>
            <span>wenig</span>
            <span>viel</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-text">Schlaf letzte Nacht</p>
          <div className="mt-2">
            <RatingDots value={sleep} onChange={setSleep} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-text-tertiary" style={{ maxWidth: '9.5rem' }}>
            <span>schlecht</span>
            <span>gut</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-text">Was trifft zu?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tagKeys.map((key) => (
              <ToggleChip key={key} label={dayTagLabels[key]} active={tags.includes(key)} onClick={() => toggleTag(key)} />
            ))}
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Noch etwas?"
          rows={3}
          className="rounded-2xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
        />

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Speichern …' : 'Tag abschließen'}
        </button>
      </div>
    </div>
  )
}
