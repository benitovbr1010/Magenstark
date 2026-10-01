import { BookOpen, CheckCircle2, ChevronRight, Circle, FileText, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SavedMealSheet } from '../components/SavedMealSheet'
import { StepSheet } from '../components/StepSheet'
import { ToggleChip } from '../components/ToggleChip'
import { UploadSheet } from '../components/UploadSheet'
import { useAuth } from '../lib/AuthContext'
import { stepStatusLabels, themeModeLabels } from '../lib/constants'
import type { Database } from '../lib/database.types'
import { exportAsCsv, exportAsJson, fetchAllUserData } from '../lib/exportData'
import { fetchSavedMeals, type SavedMealRow } from '../lib/savedMeals'
import { supabase } from '../lib/supabaseClient'
import { type ThemeMode, useTheme } from '../lib/theme'

type StepRow = Database['public']['Tables']['steps']['Row']
type DocumentRow = Database['public']['Tables']['documents']['Row']

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

export function MyWay() {
  const { session } = useAuth()
  const [steps, setSteps] = useState<StepRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [stepSheetOpen, setStepSheetOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<StepRow | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [themeMode, setThemeMode] = useTheme(session?.user.id)
  const [exporting, setExporting] = useState(false)
  const [savedMeals, setSavedMeals] = useState<SavedMealRow[]>([])
  const [editingSavedMeal, setEditingSavedMeal] = useState<SavedMealRow | null>(null)
  const [savedMealSheetOpen, setSavedMealSheetOpen] = useState(false)

  function reloadSavedMeals() {
    if (!session) return
    fetchSavedMeals(session.user.id).then(setSavedMeals)
  }

  useEffect(reloadSavedMeals, [session])

  async function handleExport(format: 'json' | 'csv') {
    if (!session) return
    setExporting(true)
    const data = await fetchAllUserData(session.user.id)
    if (format === 'json') {
      exportAsJson(data)
    } else {
      exportAsCsv(data)
    }
    setExporting(false)
  }

  function reload() {
    if (!session) return
    Promise.all([
      supabase.from('steps').select('*').eq('user_id', session.user.id).order('sort_order'),
      supabase.from('documents').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
    ]).then(([stepsRes, documentsRes]) => {
      setSteps(stepsRes.data ?? [])
      setDocuments(documentsRes.data ?? [])
      setLoading(false)
    })
  }

  useEffect(reload, [session])

  function openAddStep() {
    setEditingStep(null)
    setStepSheetOpen(true)
  }

  function openEditStep(step: StepRow) {
    setEditingStep(step)
    setStepSheetOpen(true)
  }

  async function moveStep(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= steps.length) return
    const a = steps[index]
    const b = steps[targetIndex]
    await Promise.all([
      supabase.from('steps').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('steps').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    reload()
  }

  if (loading) {
    return null
  }

  const nextSortOrder = steps.length ? Math.max(...steps.map((s) => s.sort_order)) + 1 : 0

  return (
    <div className="px-4 pt-6 pb-10">
      <h1 className="text-2xl font-semibold text-text">Mein Weg</h1>
      <p className="mt-1 text-sm text-text-secondary">Schritte, um die Ursache zu finden</p>

      <Link
        to="/wissen"
        className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <BookOpen size={22} className="shrink-0 text-primary-text" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">Wissen</p>
          <p className="text-xs text-text-tertiary">FODMAPs, Auslöser, Bristol-Skala & mehr</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
      </Link>

      <div className="mt-5 flex flex-col gap-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => openEditStep(step)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left"
          >
            {step.status === 'done' ? (
              <CheckCircle2 size={22} className="shrink-0 text-primary" />
            ) : (
              <Circle size={22} className={`shrink-0 ${step.status === 'planned' ? 'text-primary' : 'text-text-tertiary'}`} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">{step.title}</p>
              {step.result_short && <p className="text-xs text-text-tertiary">{step.result_short}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs text-text-secondary">
                {stepStatusLabels[step.status as keyof typeof stepStatusLabels]}
                {step.status === 'planned' && step.date ? ` ${formatShortDate(step.date)}` : ''}
              </span>
              <span className="flex gap-1">
                <span
                  role="button"
                  aria-label="Nach oben"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveStep(index, -1)
                  }}
                  className="text-text-tertiary"
                >
                  ↑
                </span>
                <span
                  role="button"
                  aria-label="Nach unten"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveStep(index, 1)
                  }}
                  className="text-text-tertiary"
                >
                  ↓
                </span>
              </span>
            </div>
          </button>
        ))}

        <button type="button" onClick={openAddStep} className="mt-1 text-left text-sm font-medium text-primary-text">
          + Schritt hinzufügen
        </button>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-text">Dokumente</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-text-tertiary"
        >
          <Plus size={22} />
          <span className="text-xs">Hochladen</span>
        </button>
        {documents.map((doc) => (
          <Link
            key={doc.id}
            to={`/dokument?id=${doc.id}`}
            className="flex aspect-square flex-col justify-between rounded-2xl border border-border bg-card p-3"
          >
            <FileText size={20} className="text-text-tertiary" />
            <div>
              <p className="truncate text-xs font-medium text-text">{doc.title}</p>
              {doc.doc_date && <p className="text-xs text-text-tertiary">{formatShortDate(doc.doc_date)}</p>}
            </div>
          </Link>
        ))}
      </div>

      {savedMeals.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-text">Meine Mahlzeiten</h2>
          <div className="mt-3 flex flex-col gap-2">
            {savedMeals.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => {
                  setEditingSavedMeal(meal)
                  setSavedMealSheetOpen(true)
                }}
                className="rounded-2xl border border-border bg-card p-4 text-left"
              >
                <p className="text-sm font-medium text-text">{meal.name}</p>
                <p className="truncate text-xs text-text-tertiary">{meal.summary}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 text-lg font-semibold text-text">Einstellungen</h2>
      <div className="mt-3 flex flex-col gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-text">Darstellung</p>
          <div className="mt-3 flex gap-2">
            {(Object.keys(themeModeLabels) as ThemeMode[]).map((mode) => (
              <ToggleChip key={mode} label={themeModeLabels[mode]} active={themeMode === mode} onClick={() => setThemeMode(mode)} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-text">Alle Daten exportieren</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport('json')}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-secondary disabled:opacity-40"
            >
              Als JSON
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => handleExport('csv')}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-secondary disabled:opacity-40"
            >
              Als CSV
            </button>
          </div>
        </div>
      </div>

      {session && (
        <>
          <StepSheet
            open={stepSheetOpen}
            onClose={() => setStepSheetOpen(false)}
            userId={session.user.id}
            step={editingStep}
            nextSortOrder={nextSortOrder}
            onSaved={reload}
          />
          <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} userId={session.user.id} onSaved={reload} />
          <SavedMealSheet
            open={savedMealSheetOpen}
            onClose={() => setSavedMealSheetOpen(false)}
            userId={session.user.id}
            existing={editingSavedMeal}
            onSaved={reloadSavedMeals}
          />
        </>
      )}
    </div>
  )
}
