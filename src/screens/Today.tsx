import { Activity, GlassWater, Mic, Minus, Soup } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BristolIcon } from '../components/BristolIcon'
import { ContextSheet } from '../components/ContextSheet'
import { KnowledgeSheet } from '../components/KnowledgeSheet'
import { MarkerChip } from '../components/MarkerChip'
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
  urgencyLabels,
} from '../lib/constants'
import { fetchLatestContext, isContextExpired, type ActiveContext } from '../lib/context'
import type { Database } from '../lib/database.types'
import {
  endOfDay,
  formatGermanDate,
  formatGermanTime,
  isSameDay,
  nowOnDate,
  startOfDay,
  toDateOnly,
} from '../lib/datetime'
import { goodMarkerArticle, markerArticle, type KnowledgeArticle } from '../lib/knowledge'
import { supabase } from '../lib/supabaseClient'
import { addWaterLog, fetchWaterLogs, formatLiters, removeWaterLog, totalMl, type WaterLogRow } from '../lib/water'

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

const bowelFlagKeys = Object.keys(flagLabels) as (keyof typeof flagLabels)[]

export function Today() {
  const { session } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [waterLogs, setWaterLogs] = useState<WaterLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<ActiveContext | null>(null)
  const [contextSheetOpen, setContextSheetOpen] = useState(false)
  const [dayClosingDone, setDayClosingDone] = useState(false)
  const [infoArticle, setInfoArticle] = useState<KnowledgeArticle | null>(null)

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

  function reloadWater() {
    if (!session) return
    fetchWaterLogs(session.user.id, startOfDay(selectedDate), endOfDay(selectedDate)).then(setWaterLogs)
  }

  async function handleAddWater() {
    if (!session) return
    await addWaterLog(session.user.id, nowOnDate(selectedDate))
    reloadWater()
  }

  async function handleRemoveWater() {
    const last = waterLogs[waterLogs.length - 1]
    if (!last) return
    await removeWaterLog(last.id)
    reloadWater()
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
      fetchWaterLogs(session.user.id, startOfDay(selectedDate), endOfDay(selectedDate)),
    ]).then(([bowelRes, wellbeingRes, mealsRes, waterRes]) => {
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
      setWaterLogs(waterRes)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [session, selectedDate])

  const isToday = isSameDay(selectedDate, new Date())
  const captureSuffix = isToday ? '' : `?date=${toDateOnly(selectedDate)}`
  const waterCount = waterLogs.length
  const waterTotal = totalMl(waterLogs)

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

      <button
        type="button"
        onClick={handleAddWater}
        className="mt-6 flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left"
      >
        <div className="flex items-center gap-1.5">
          {Array.from({ length: Math.min(waterCount, 8) }).map((_, i) => (
            <GlassWater key={i} size={18} className="shrink-0 text-primary-text" />
          ))}
          {waterCount > 8 && <span className="text-xs text-text-tertiary">+{waterCount - 8}</span>}
          {waterCount === 0 && <GlassWater size={18} className="shrink-0 text-text-tertiary" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">
            {waterCount} {waterCount === 1 ? 'Glas' : 'Gläser'} · {formatLiters(waterTotal)}
          </span>
          <span
            role="button"
            aria-label="Letztes Glas entfernen"
            onClick={(e) => {
              e.stopPropagation()
              handleRemoveWater()
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-text-tertiary"
          >
            <Minus size={14} />
          </span>
        </div>
      </button>

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
                      {(() => {
                        const flagTexts = [
                          ...bowelFlagKeys.filter((k) => entry.row[k]).map((k) => flagLabels[k]),
                          ...(entry.row.urgency > 0
                            ? [`Dringend (${urgencyLabels[entry.row.urgency as 1 | 2]})`]
                            : []),
                        ]
                        return (
                          flagTexts.length > 0 && <p className="mt-1 text-xs text-warning">{flagTexts.join(' · ')}</p>
                        )
                      })()}
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
                          stress: entry.row.stress,
                          rumbling: entry.row.rumbling,
                          heartburn: entry.row.heartburn,
                        })}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <>
                    <Link to={`/mahlzeit?id=${entry.row.id}`} className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-text">
                        <Soup size={18} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-tertiary">{formatGermanTime(entry.time)}</p>
                        <p className="text-sm font-medium text-text">
                          {mealTypeLabels[entry.row.meal_type as keyof typeof mealTypeLabels]}
                        </p>
                        <p className="text-sm text-text-secondary">{entry.row.summary}</p>
                      </div>
                    </Link>
                    {(() => {
                      const markers = capChips(entry.row.markers as (keyof typeof markerLabels)[])
                      const goodMarkers = capChips(entry.row.good_markers as (keyof typeof goodMarkerLabels)[])
                      if (markers.shown.length === 0 && goodMarkers.shown.length === 0) return null
                      return (
                        <div className="ml-12 mt-1.5 flex flex-col gap-1.5">
                          {markers.shown.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {markers.shown.map((m) => (
                                <MarkerChip
                                  key={m}
                                  label={markerLabels[m]}
                                  tone="warning"
                                  onInfo={() => setInfoArticle(markerArticle(m, markerLabels[m]))}
                                />
                              ))}
                              {markers.extra > 0 && (
                                <span className="px-1 text-xs text-text-tertiary">+{markers.extra}</span>
                              )}
                            </div>
                          )}
                          {goodMarkers.shown.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {goodMarkers.shown.map((m) => (
                                <MarkerChip
                                  key={m}
                                  label={goodMarkerLabels[m]}
                                  tone="primary"
                                  onInfo={() => setInfoArticle(goodMarkerArticle(m, goodMarkerLabels[m]))}
                                />
                              ))}
                              {goodMarkers.extra > 0 && (
                                <span className="px-1 text-xs text-text-tertiary">+{goodMarkers.extra}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isToday && !dayClosingDone && new Date().getHours() >= 19 && (
        <Link
          to="/tagesabschluss"
          className="mt-4 block rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm font-medium text-primary-text"
        >
          Tag abschließen
        </Link>
      )}

      <div className="mt-8 flex items-center justify-between px-4">
        <Link to={`/toilette${captureSuffix}`} className="text-sm font-medium text-primary-text">
          Toilette
        </Link>
        <Link
          to={`/mahlzeit${captureSuffix}`}
          aria-label="Erzählen"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white"
        >
          <Mic size={24} strokeWidth={1.75} />
        </Link>
        <Link to={`/befinden${captureSuffix}`} className="text-sm font-medium text-primary-text">
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

      <KnowledgeSheet article={infoArticle} onClose={() => setInfoArticle(null)} />
    </div>
  )
}
