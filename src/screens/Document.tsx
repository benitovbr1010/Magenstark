import { CheckCircle2, Circle, FileText, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ScreenHeader } from '../components/ScreenHeader'
import { findingStatusLabels, labStatusLabels } from '../lib/constants'
import type { Database } from '../lib/database.types'
import { toDateOnly } from '../lib/datetime'
import { supabase } from '../lib/supabaseClient'

type DocumentRow = Database['public']['Tables']['documents']['Row']
type DoctorQuestionRow = Database['public']['Tables']['doctor_questions']['Row']
type DocumentChatRow = Database['public']['Tables']['document_chats']['Row']
type StepRow = Database['public']['Tables']['steps']['Row']

type Finding = {
  name: string
  quote: string
  explanation: string
  kind: 'lab' | 'finding'
  status: string
  value?: string
  unit?: string
  reference_range?: string
}

type DocumentAnalysis = {
  summary: string
  findings: Finding[]
  recommendations: { text: string; quote: string }[]
  missing_info: string[]
  additional_info: { name: string; value: string }[]
  questions: string[]
}

const imageExtensions = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif']

function formatGermanDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function Document() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = searchParams.get('id')
  const [doc, setDoc] = useState<DocumentRow | null>(null)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<DoctorQuestionRow[]>([])
  const [chats, setChats] = useState<DocumentChatRow[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false)
  const [allSteps, setAllSteps] = useState<StepRow[]>([])
  const [selectedStepId, setSelectedStepId] = useState('')
  const [stepUpdating, setStepUpdating] = useState(false)
  const [addedRecommendations, setAddedRecommendations] = useState<Set<number>>(new Set())

  const analysis = doc?.analysis as DocumentAnalysis | null

  function loadDoc() {
    if (!id) return
    supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (data) {
          setDoc(data)
          const paths = data.file_paths?.length ? data.file_paths : [data.file_path]
          const signedUrls = await Promise.all(
            paths.map(async (path) => {
              const { data: signed } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
              return signed?.signedUrl ?? null
            }),
          )
          setPreviewUrls(signedUrls.filter((url): url is string => Boolean(url)))
        }
        setLoading(false)
      })
  }

  function loadQuestions() {
    if (!id) return
    supabase
      .from('doctor_questions')
      .select('*')
      .eq('document_id', id)
      .order('created_at')
      .then(({ data }) => setQuestions(data ?? []))
  }

  function loadChats() {
    if (!id) return
    supabase
      .from('document_chats')
      .select('*')
      .eq('document_id', id)
      .order('created_at')
      .then(({ data }) => setChats(data ?? []))
  }

  function loadSteps() {
    if (!doc) return
    supabase
      .from('steps')
      .select('*')
      .eq('user_id', doc.user_id)
      .order('sort_order')
      .then(({ data }) => setAllSteps(data ?? []))
  }

  useEffect(loadDoc, [id])
  useEffect(loadQuestions, [id])
  useEffect(loadChats, [id])
  useEffect(loadSteps, [doc?.id])

  const openSteps = allSteps.filter((s) => s.status !== 'done')
  const nextSortOrder = allSteps.length ? Math.max(...allSteps.map((s) => s.sort_order)) + 1 : 0

  function handleOpen(url: string) {
    window.open(url, '_blank')
  }

  async function handleDelete() {
    if (!doc) return
    setDeleting(true)
    const paths = doc.file_paths?.length ? doc.file_paths : [doc.file_path]
    await supabase.storage.from('documents').remove(paths)
    await supabase.from('documents').delete().eq('id', doc.id)
    setDeleting(false)
    navigate('/mein-weg')
  }

  async function handleAnalyze() {
    if (!doc) return
    setAnalyzing(true)
    setAnalyzeError(null)
    setAddedRecommendations(new Set())
    const { data, error } = await supabase.functions.invoke('analyze-document', { body: { documentId: doc.id } })
    if (error || !data || data.error) {
      setAnalyzeError('Auswertung fehlgeschlagen. Bitte erneut versuchen.')
      setAnalyzing(false)
      return
    }
    const { documentIds, ...result } = data as DocumentAnalysis & { documentIds: string[] }
    const targetIds = documentIds?.length ? documentIds : [doc.id]
    await supabase.from('documents').update({ analysis: result }).in('id', targetIds)
    await supabase.from('doctor_questions').delete().in('document_id', targetIds)
    if (result.questions.length > 0) {
      await supabase.from('doctor_questions').insert(
        targetIds.flatMap((docId) =>
          result.questions.map((text) => ({
            user_id: doc.user_id,
            document_id: docId,
            text,
            saved: false,
          })),
        ),
      )
    }
    setAnalyzing(false)
    loadDoc()
    loadQuestions()
  }

  async function toggleQuestion(question: DoctorQuestionRow) {
    await supabase.from('doctor_questions').update({ saved: !question.saved }).eq('id', question.id)
    loadQuestions()
  }

  async function handleCompleteStep() {
    if (!selectedStepId || !doc || !analysis) return
    setStepUpdating(true)
    await supabase
      .from('steps')
      .update({
        status: 'done',
        date: doc.doc_date ?? toDateOnly(new Date()),
        result_short: analysis.summary.slice(0, 80),
      })
      .eq('id', selectedStepId)
    setStepUpdating(false)
    setSelectedStepId('')
    loadSteps()
  }

  async function handleAddRecommendationAsStep(text: string, index: number) {
    if (!doc) return
    await supabase.from('steps').insert({
      user_id: doc.user_id,
      title: text,
      status: 'open',
      sort_order: nextSortOrder + index,
    })
    setAddedRecommendations((prev) => new Set(prev).add(index))
    loadSteps()
  }

  async function handleSendChat() {
    if (!doc || !chatInput.trim()) return
    const message = chatInput.trim()
    setChatInput('')
    setChatSending(true)

    await supabase.from('document_chats').insert({ document_id: doc.id, role: 'user', content: message })
    loadChats()

    const { data } = await supabase.functions.invoke('document-chat', {
      body: {
        documentTitle: doc.title,
        analysisSummary: analysis?.summary ?? null,
        history: chats.map((c) => ({ role: c.role, content: c.content })),
        message,
      },
    })

    if (data?.reply) {
      await supabase.from('document_chats').insert({ document_id: doc.id, role: 'assistant', content: data.reply })
    }
    setChatSending(false)
    loadChats()
  }

  if (loading || !doc) {
    return null
  }

  const docPaths = doc.file_paths?.length ? doc.file_paths : [doc.file_path]
  const isImage = docPaths.every((p) => imageExtensions.includes(p.split('.').pop()?.toLowerCase() ?? ''))

  return (
    <div className="pb-10">
      <ScreenHeader
        title={doc.title}
        subtitle={[doc.doc_date ? formatGermanDate(doc.doc_date) : null, doc.source].filter(Boolean).join(' · ')}
      />

      <div className="mt-6 flex flex-col gap-4 px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
          {isImage && previewUrls.length > 0 ? (
            <div className={`grid w-full gap-2 ${previewUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {previewUrls.map((url, i) => (
                <button key={i} type="button" onClick={() => handleOpen(url)} className="block">
                  <img src={url} alt={`${doc.title} ${i + 1}`} className="max-h-64 w-full rounded-xl object-contain" />
                </button>
              ))}
            </div>
          ) : (
            <>
              <FileText size={48} className="text-text-tertiary" />
              <button
                type="button"
                disabled={previewUrls.length === 0}
                onClick={() => previewUrls[0] && handleOpen(previewUrls[0])}
                className="rounded-full bg-primary-light px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-40"
              >
                Öffnen
              </button>
            </>
          )}
        </div>

        {!analysis ? (
          <button
            type="button"
            disabled={analyzing}
            onClick={handleAnalyze}
            className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {analyzing ? 'Auswerten …' : 'Auswerten'}
          </button>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-primary-text">Das Wichtigste</p>
              <button
                type="button"
                disabled={analyzing}
                onClick={handleAnalyze}
                className="text-xs font-medium text-text-tertiary"
              >
                {analyzing ? 'Auswerten …' : 'Erneut auswerten'}
              </button>
            </div>
            <p className="mt-2 text-sm text-text">{analysis.summary}</p>

            {analysis.findings.length > 0 && (
              <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-primary-text">Einzelbefunde</p>
                {analysis.findings.map((f, i) => {
                  const isNormal = f.kind === 'lab' ? f.status === 'normal' : f.status === 'unauffaellig'
                  const label =
                    f.kind === 'lab'
                      ? labStatusLabels[f.status as keyof typeof labStatusLabels]
                      : findingStatusLabels[f.status as keyof typeof findingStatusLabels]
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-text">{f.name}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                            isNormal ? 'bg-primary-light text-primary-text' : 'bg-warning-light text-warning'
                          }`}
                        >
                          {label ?? f.status}
                        </span>
                      </div>
                      {f.kind === 'lab' && (f.value || f.reference_range) && (
                        <p className="text-xs text-text-tertiary">
                          {f.value} {f.unit} · Referenz {f.reference_range}
                        </p>
                      )}
                      <p className="text-sm text-text-secondary">{f.explanation}</p>
                      <p className="text-xs italic text-text-tertiary">„{f.quote}"</p>
                    </div>
                  )
                })}
              </div>
            )}

            {analysis.recommendations.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-primary-text">Empfehlungen deines Arztes</p>
                {analysis.recommendations.map((r, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <p className="text-sm text-text">{r.text}</p>
                    <p className="text-xs italic text-text-tertiary">„{r.quote}"</p>
                    <button
                      type="button"
                      disabled={addedRecommendations.has(i)}
                      onClick={() => handleAddRecommendationAsStep(r.text, i)}
                      className="mt-1 self-start text-xs font-medium text-primary-text disabled:text-text-tertiary"
                    >
                      {addedRecommendations.has(i) ? 'Als Schritt hinzugefügt' : '+ Als Schritt zu „Mein Weg" hinzufügen'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {analysis.missing_info.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-primary-text">Was nicht im Befund steht</p>
                <div className="mt-2 flex flex-col gap-1">
                  {analysis.missing_info.map((m, i) => (
                    <p key={i} className="text-sm text-text-secondary">
                      · {m}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {analysis.additional_info.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdditionalInfo((v) => !v)}
                  className="text-xs font-medium text-text-tertiary"
                >
                  {showAdditionalInfo ? 'Weitere Angaben ausblenden' : 'Weitere Angaben anzeigen'}
                </button>
                {showAdditionalInfo && (
                  <div className="mt-2 flex flex-col gap-1">
                    {analysis.additional_info.map((a, i) => (
                      <div key={i} className="flex justify-between text-xs text-text-tertiary">
                        <span>{a.name}</span>
                        <span>{a.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 text-xs text-text-tertiary">Keine Diagnose. Bitte mit deinem Arzt besprechen.</p>
          </div>
        )}

        {analyzeError && <p className="text-sm text-warning">{analyzeError}</p>}

        {analysis && openSteps.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-primary-text">Mein Weg aktualisieren</p>
            <p className="mt-1 text-xs text-text-tertiary">Passenden Schritt mit diesem Ergebnis abschließen?</p>
            <div className="mt-3 flex flex-col gap-2">
              <select
                value={selectedStepId}
                onChange={(e) => setSelectedStepId(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
              >
                <option value="">Schritt auswählen …</option>
                {openSteps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedStepId || stepUpdating}
                onClick={handleCompleteStep}
                className="self-start rounded-full bg-primary-light px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-40"
              >
                {stepUpdating ? 'Speichern …' : 'Als erledigt markieren'}
              </button>
            </div>
          </div>
        )}

        {questions.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-primary-text">Fragen für deinen Arzt</p>
            <div className="mt-3 flex flex-col gap-3">
              {questions.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => toggleQuestion(q)}
                  className="flex items-start gap-2 text-left"
                >
                  {q.saved ? (
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
                  ) : (
                    <Circle size={18} className="mt-0.5 shrink-0 text-text-tertiary" />
                  )}
                  <span className="text-sm text-text">{q.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-primary-text">Frag etwas zu diesem Befund</p>
          <div className="mt-3 flex flex-col gap-2">
            {chats.map((c) => (
              <div
                key={c.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  c.role === 'user' ? 'self-end bg-primary-light text-primary-text' : 'self-start bg-background text-text'
                }`}
              >
                {c.content}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Frag etwas zu diesem Befund …"
              className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm text-text outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!chatInput.trim() || chatSending}
              onClick={handleSendChat}
              aria-label="Senden"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        <button type="button" disabled={deleting} onClick={handleDelete} className="text-sm font-medium text-warning">
          Dokument löschen
        </button>
      </div>
    </div>
  )
}
