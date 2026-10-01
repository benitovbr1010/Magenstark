import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DateTimeField } from '../components/DateTimeField'
import { ScreenHeader } from '../components/ScreenHeader'
import { ToggleChip } from '../components/ToggleChip'
import { useAuth } from '../lib/AuthContext'
import { situationLabels, symptomLabels } from '../lib/constants'
import { fetchLatestContext, type ActiveContext } from '../lib/context'
import { withDatePart } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'

const moodColors = ['#E6E9E7', '#C9D2CB', '#A9BBAE', '#8CA791', '#6F8A74']
const symptomKeys = Object.keys(symptomLabels) as (keyof typeof symptomLabels)[]
const situationKeys = Object.keys(situationLabels) as (keyof typeof situationLabels)[]

export function Wellbeing() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('id')
  const dateParam = searchParams.get('date')
  const { session } = useAuth()
  const [occurredAt, setOccurredAt] = useState(() => (dateParam ? withDatePart(new Date(), dateParam) : new Date()))
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [sliders, setSliders] = useState<Record<keyof typeof symptomLabels, number>>({
    abdominal_pain: 0,
    bloating: 0,
    nausea: 0,
    fullness: 0,
    urgency: 0,
    stress: 0,
    rumbling: 0,
    heartburn: 0,
  })
  const [situation, setSituation] = useState<keyof typeof situationLabels | null>(null)
  const [toiletReachable, setToiletReachable] = useState<boolean | null>(null)
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
      .from('wellbeing')
      .select('*')
      .eq('id', editId)
      .single()
      .then(({ data }) => {
        if (data) {
          setOccurredAt(new Date(data.occurred_at))
          setMood(data.mood as 1 | 2 | 3 | 4 | 5)
          setSliders({
            abdominal_pain: data.abdominal_pain,
            bloating: data.bloating,
            nausea: data.nausea,
            fullness: data.fullness,
            urgency: data.urgency,
            stress: data.stress,
            rumbling: data.rumbling,
            heartburn: data.heartburn,
          })
          setSituation((data.situation as keyof typeof situationLabels) ?? null)
          setToiletReachable(data.toilet_reachable)
          setNote(data.note ?? '')
        }
        setLoading(false)
      })
  }, [editId])

  async function handleSave() {
    if (!mood || !session) return
    setSaving(true)
    const payload = {
      user_id: session.user.id,
      occurred_at: occurredAt.toISOString(),
      mood,
      ...sliders,
      situation,
      toilet_reachable: toiletReachable,
      note: note.trim() || null,
      ...(editId ? {} : { place: activeContext?.place ?? null, phase: activeContext?.phase ?? null }),
    }
    const { error } = editId
      ? await supabase.from('wellbeing').update(payload).eq('id', editId)
      : await supabase.from('wellbeing').insert(payload)
    setSaving(false)
    if (!error) {
      navigate('/')
    }
  }

  async function handleDelete() {
    if (!editId) return
    setSaving(true)
    const { error } = await supabase.from('wellbeing').delete().eq('id', editId)
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
      <ScreenHeader title="Wie geht es dir?" />

      <div className="mt-4 flex flex-col gap-6 px-4">
        <DateTimeField value={occurredAt} onChange={setOccurredAt} />

        <div>
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-text-tertiary">schlecht</span>
            <span className="text-sm text-text-tertiary">gut</span>
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            {([1, 2, 3, 4, 5] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Stimmung ${value}`}
                onClick={() => setMood(value)}
                className="flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  backgroundColor: moodColors[value - 1],
                  outline: mood === value ? '2px solid #3F5A45' : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        {symptomKeys.map((key) => (
          <div key={key}>
            <p className="text-sm font-medium text-text">{symptomLabels[key]}</p>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={sliders[key]}
              onChange={(e) => setSliders((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
              className="mt-2 w-full"
              style={{ accentColor: '#6F8A74' }}
            />
            <div className="flex justify-between text-xs text-text-tertiary">
              <span>gar nicht</span>
              <span>stark</span>
            </div>
          </div>
        ))}

        <div>
          <p className="text-sm font-medium text-text">Situation</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {situationKeys.map((key) => (
              <ToggleChip
                key={key}
                label={situationLabels[key]}
                active={situation === key}
                onClick={() => setSituation(key)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-text">Toilette erreichbar</p>
          <div className="mt-2 flex gap-2">
            <ToggleChip label="Ja" active={toiletReachable === true} onClick={() => setToiletReachable(true)} />
            <ToggleChip label="Nein" active={toiletReachable === false} onClick={() => setToiletReachable(false)} />
          </div>
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
          disabled={!mood || saving}
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
