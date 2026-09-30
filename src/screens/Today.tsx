import { Activity, Mic, Soup } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BristolIcon } from '../components/BristolIcon'
import { ContextSheet } from '../components/ContextSheet'
import { WeekStrip } from '../components/WeekStrip'
import { useAuth } from '../lib/AuthContext'
import {
  bristolLabels,
  describeStrongestSymptom,
  flagLabels,
  goodMarkerLabels,
  markerLabels,
  mealTypeLabels,
  phaseLabels,
} from '../lib/constants'
import { fetchLatestContext, isContextExpired, type ActiveContext } from '../lib/context'
import type { Database } from '../lib/database.types'
import { endOfDay, formatGermanDate, formatGermanTime, isSameDay, startOfDay, toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'

type BowelRow = Database['public']['Tables']['bowel_movements']['Row']
type WellbeingRow = Database['public']['Tables']['wellbeing']['Row']
type MealRow = Database['public']['Tables']['meals']['Row']

type TimelineEntry =
  | { kind: 'bowel'; time: Date; row: BowelRow }
  | { kind: 'wellbeing'; time: Date; row: WellbeingRow }
  | { kind: 'meal'; time: Date; row: MealRow }

function capChips<T extends string>(items: T[], max = 3): { shown: T[]; extra: number } {
  return { shown: items.slice(0, max), extra: Math.max(0, items.length - max) }
}

export function Today() {
  const { session } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<ActiveContext | null>(null)
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [dayClosingDone, setDayClosingDone] = useState(false)

  function reloadContext() {
    if (!session) return
    fetchLatestContext(session.user.id).then(setContext)
  }

  useEffect(reloadContext, [session])

  useEffect(() => {
    if (!session) return
    supabase
      .from('day_closings')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('date', toDateOnly(new Date()))
      .maybeSingle()
      .then(({ data }) => setDayClosingDone(!!data))
  }, [session])

  async function handleExtendContext() {
    if (!context) return
    await supabase.from('contexts').update({ end_date: null }).eq('id', context.id)
    reloadContext()
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    setLoading(true)

    const from = startOfDay(selectedDate).toISOString()
    const to = endOfDay(selectedDate).toISOString()

    Promise.all([
      supabase
        .from('bowel_movements')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('occurred_at', from)
        .lte('occurred_at', to),
      supabase
        .from('wellbeing')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('occurred_at', from)
        .lte('occurred_at', to),
      supabase
        .from('meals')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('eaten_at', from)
        .lte('eaten_at', to),
    ]).then(([bowelRes, wellbeingRes, mealsRes]) => {
      if (cancelled) return
      const bowelEntries: TimelineEntry[] = (bowelRes.data ?? []).map((row) => ({
        kind: 'bowel',
        time: new Date(row.occurred_at),
        row,
      }))
      const wellbeingEntries: TimelineEntry[] = (wellbeingRes.data ?? []).map((row) => ({
        kind: 'wellbeing',
        time: new Date(row.occurred_at),
        row,
      }))
      const mealEntries: TimelineEntry[] = (mealsRes.data ?? []).map((row) => ({
        kind: 'meal',
        time: new Date(row.eaten_at),
        row,
      }))
      setEntries(
        [...bowelEntries, ...wellbeingEntries, ...mealEntries].sort((a, b) => a.time.getTime() - b.time.getTime()),
      )
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [session, selectedDate])

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-semibold text-text">Heute</h1>
      <p className="mt-1 text-sm text-text-secondary">{formatGermanDate(selectedDate)}</p>

      <div className="mt-3">
        {context && isContextExpired(context) ? (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <span className="text-sm text-text">Noch in {context.place}?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExtendContext}
                className="rounded-full bg-primary-light px-3 py-1.5 text-sm font-medium text-primary-text"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => setContextSheetOpen(true)}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-secondary"
              >
                Ändern
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setContextSheetOpen(true)}
            className="rounded-full bg-primary-light px-3 py-1.5 text-sm font-medium text-primary-text"
          >
            {context ? `${context.place} · ${phaseLabels[context.phase]}` : 'Wo bist du gerade?'}
          </button>
        )}
      </div>

      <div className="-mx-4 mt-6">
        <WeekStrip selected={selectedDate} onSelect={setSelectedDate} />
      </div>

      <div className="mt-6">
        {loading ? null : entries.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm text-text-tertiary">Noch keine Einträge {formatGermanDate(selectedDate)}.</p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.row.id}`} className="border-b border-border py-4 last:border-none">
                {entry.kind === 'bowel' ? (
                  <Link to={`/toilette?id=${entry.row.id}`} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text">
                      <BristolIcon type={entry.row.bristol as 1 | 2 | 3 | 4 | 5 | 6 | 7} className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs text-text-tertiary">{formatGermanTime(entry.time)}</p>
                      <p className="text-sm font-medium text-text">Toilette</p>
                      <p className="text-sm text-text-secondary">
                        Typ {entry.row.bristol} · {bristolLabels[entry.row.bristol as 1 | 2 | 3 | 4 | 5 | 6 | 7]}
                      </p>
                      {(['pain', 'urgent', 'incomplete', 'mucus', 'blood'] as const).some((k) => entry.row[k]) && (
                        <p className="mt-1 text-xs text-warning">
                          {(['pain', 'urgent', 'incomplete', 'mucus', 'blood'] as const)
                            .filter((k) => entry.row[k])
                            .map((k) => flagLabels[k])
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </Link>
                ) : entry.kind === 'wellbeing' ? (
                  <Link to={`/befinden?id=${entry.row.id}`} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text">
                      <Activity size={18} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-xs text-text-tertiary">{formatGermanTime(entry.time)}</p>
                      <p className="text-sm font-medium text-text">Befinden</p>
                      <p className="text-sm text-text-secondary">
                        {describeStrongestSymptom({
                          abdominal_pain: entry.row.abdominal_pain,
                          bloating: entry.row.bloating,
                          nausea: entry.row.nausea,
                          fullness: entry.row.fullness,
                          urgency: entry.row.urgency,
                        })}
                      </p>
                    </div>
                  </Link>
                ) : (
                  (() => {
                    const chips = capChips([
                      ...(entry.row.markers as (keyof typeof markerLabels)[]),
                      ...(entry.row.good_markers as (keyof typeof goodMarkerLabels)[]),
                    ])
                    return (
                      <Link to={`/mahlzeit?id=${entry.row.id}`} className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text">
                          <Soup size={18} strokeWidth={1.75} />
                        </span>
                        <div>
                          <p className="text-xs text-text-tertiary">{formatGermanTime(entry.time)}</p>
                          <p className="text-sm font-medium text-text">
                            {mealTypeLabels[entry.row.meal_type as keyof typeof mealTypeLabels]}
                          </p>
                          <p className="text-sm text-text-secondary">{entry.row.summary}</p>
                          {chips.shown.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {chips.shown.map((m) => {
                                const isGood = m in goodMarkerLabels
                                return (
                                  <span
                                    key={m}
                                    className={`rounded-full px-2.5 py-0.5 text-xs ${
                                      isGood ? 'bg-primary-light text-primary-text' : 'bg-warning-light text-warning'
                                    }`}
                                  >
                                    {isGood
                                      ? goodMarkerLabels[m as keyof typeof goodMarkerLabels]
                                      : markerLabels[m as keyof typeof markerLabels]}
                                  </span>
                                )
                              })}
                              {chips.extra > 0 && (
                                <span className="rounded-full px-2.5 py-0.5 text-xs text-text-tertiary">
                                  +{chips.extra}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })()
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isSameDay(selectedDate, new Date()) && !dayClosingDone && new Date().getHours() >= 19 && (
        <Link
          to="/tagesabschluss"
          className="mt-4 block rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm font-medium text-primary-text"
        >
          Tag abschließen
        </Link>
      )}

      <div className="mt-8 flex items-center justify-between px-4">
        <Link to="/toilette" className="text-sm font-medium text-primary-text">
          Toilette
        </Link>
        <Link
          to="/mahlzeit"
          aria-label="Erzählen"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white"
        >
          <Mic size={24} strokeWidth={1.75} />
        </Link>
        <Link to="/befinden" className="text-sm font-medium text-primary-text">
          Befinden
        </Link>
      </div>

      {session && (
        <ContextSheet
          open={contextSheetOpen}
          onClose={() => setContextSheetOpen(false)}
          userId={session.user.id}
          currentContext={context}
          onSaved={reloadContext}
        />
      )}
    </div>
  )
}
