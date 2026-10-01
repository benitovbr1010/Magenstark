import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BristolIcon } from '../components/BristolIcon'
import { DateTimeField } from '../components/DateTimeField'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToggleChip } from '../components/ToggleChip'
import { useAuth } from '../lib/AuthContext'
import { bristolLabels, flagLabels, urgencyLabels } from '../lib/constants'
import { fetchLatestContext, type ActiveContext } from '../lib/context'
import { withDatePart } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'

const bristolValues = [1, 2, 3, 4, 5, 6, 7] as const
const flagKeys = Object.keys(flagLabels) as (keyof typeof flagLabels)[]
const urgencyValues = [0, 1, 2] as const

export function BowelMovement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const dateParam = searchParams.get('date')
  const { session } = useAuth()
  const [occurredAt, setOccurredAt] = useState(() => (dateParam ? withDatePart(new Date(), dateParam) : new Date()))
  const [bristol, setBristol] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | null>(null)
  const [urgency, setUrgency] = useState<0 | 1 | 2>(0)
  const [flags, setFlags] = useState<Record<keyof typeof flagLabels, boolean>>({
    pain: false,
    incomplete: false,
    mucus: false,
    blood: false,
  })
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!!editId)
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null)

  useEffect(() => {
    if (editId || !session) return
    fetchLatestContext(session.user.id).then(setActiveContext)
  }, [editId, session])

  useEffect(() => {
    if (!editId) return
    supabase
      .from('bowel_movements')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data }) => {
        if (data) {
          setOccurredAt(new Date(data.occurred_at))
          setBristol(data.bristol as 1 | 2 | 3 | 4 | 5 | 6 | 7)
          setUrgency(data.urgency as 0 | 1 | 2)
          setFlags({
            pain: data.pain,
            incomplete: data.incomplete,
            mucus: data.mucus,
            blood: data.blood,
          })
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [editId])

  function toggleFlag(key: keyof typeof flagLabels) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    if (!bristol || !session) return
    setSaving(true)
    const payload = {
      user_id: session.user.id,
      occurred_at: occurredAt.toISOString(),
      bristol,
      urgency,
      ...flags,
      note: note.trim() || null,
      ...(editId ? {} : { place: activeContext?.place ?? null, phase: activeContext?.phase ?? null }),
    }
    const { error } = editId
      ? await supabase.from('bowel_movements').update(payload).eq('id', editId)
      : await supabase.from('bowel_movements').insert(payload)
    setSaving(false)
    if (!error) {
      navigate('/')
    }
  }

  async function handleDelete() {
    if (!editId) return
    setSaving(true)
    const { error } = await supabase.from('bowel_movements').delete().eq('id', editId)
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
      <ScreenHeader title="Toilettengang" />

      <div className="mt-4 flex flex-col gap-6 px-4">
        <DateTimeField value={occurredAt} onChange={setOccurredAt} />

        <div className="grid grid-cols-2 gap-3">
          {bristolValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setBristol(value)}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 ${
                bristol === value
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card text-text'
              }`}
            >
              <BristolIcon type={value} className="h-8 w-8" />
              <span className="text-sm">
                {value} {bristolLabels[value]}
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className="text-sm font-medium text-text">Dringend</p>
          <div className="mt-2 flex gap-2">
            {urgencyValues.map((value) => (
              <ToggleChip
                key={value}
                label={urgencyLabels[value]}
                active={urgency === value}
                onClick={() => setUrgency(value)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {flagKeys.map((key) => (
            <ToggleChip key={key} label={flagLabels[key]} active={flags[key]} onClick={() => toggleFlag(key)} />
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notiz hinzufügen"
          rows={3}
          className="rounded-2xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
        />

        <button
          type="button"
          disabled={!bristol || saving}
          onClick={handleSave}
          className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Speichern …' : editId ? 'Eintrag aktualisieren' : 'Eintrag speichern'}
        </button>

        {editId && (
          <button
            type="button"
            disabled={saving}
            onClick={handleDelete}
            className="text-sm font-medium text-warning"
          >
            Eintrag löschen
          </button>
        )}
      </div>
    </div>
  )
}
