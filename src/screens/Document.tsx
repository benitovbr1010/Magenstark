import { CheckCircle2, Circle, FileText, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ScreenHeader } from '../components/ScreenHeader'
import { valueStatusLabels } from '../lib/constants'
import type { Database } from '../lib/database.types'
import { supabase } from '../lib/supabaseClient'

type DocumentRow = Database['public']['Tables']['documents']['Row']
type DoctorQuestionRow = Database['public']['Tables']['doctor_questions']['Row']
type DocumentChatRow = Database['public']['Tables']['document_chats']['Row']

type DocumentAnalysis = {
  summary: string
  values: { name: string; value: string; unit: string; reference_range: string; status: string }[]
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<DoctorQuestionRow[]>([])
  const [chats, setChats] = useState<DocumentChatRow[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)

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
          const { data: signed } = await supabase.storage.from('documents').createSignedUrl(data.file_path, 3600)
          setPreviewUrl(signed?.signedUrl ?? null)
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

  useEffect(loadDoc, [id])
  useEffect(loadQuestions, [id])
  useEffect(loadChats, [id])

  async function handleOpen() {
    if (previewUrl) window.open(previewUrl, '_blank')
  }

  async function handleDelete() {
    if (!doc) return
    setDeleting(true)
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDeleting(false)
    navigate('/mein-weg')
  }

  async function handleAnalyze() {
    if (!doc) return
    setAnalyzing(true)
    setAnalyzeError(null)
    const { data, error } = await supabase.functions.invoke('analyze-document', { body: { documentId: doc.id } })
    if (error || !data || data.error) {
      setAnalyzeError('Auswertung fehlgeschlagen. Bitte erneut versuchen.')
      setAnalyzing(false)
      return
    }
    const result = data as DocumentAnalysis
    await supabase.from('documents').update({ analysis: result }).eq('id', doc.id)
    await supabase.from('doctor_questions').delete().eq('document_id', doc.id)
    if (result.questions.length > 0) {
      await supabase.from('doctor_questions').insert(
        result.questions.map((text) => ({
          user_id: doc.user_id,
          document_id: doc.id,
          text,
          saved: false,
        })),
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

  const extension = doc.file_path.split('.').pop()?.toLowerCase() ?? ''
  const isImage = imageExtensions.includes(extension)

  return (
    <div className="pb-10">
      <ScreenHeader
        title={doc.title}
        subtitle={[doc.doc_date ? formatGermanDate(doc.doc_date) : null, doc.source].filter(Boolean).join(' · ')}
      />

      <div className="mt-6 flex flex-col gap-4 px-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
          {isImage && previewUrl ? (
            <img src={previewUrl} alt={doc.title} className="max-h-64 rounded-xl object-contain" />
          ) : (
            <FileText size={48} className="text-text-tertiary" />
          )}
          <button
            type="button"
            disabled={!previewUrl}
            onClick={handleOpen}
            className="rounded-full bg-primary-light px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-40"
          >
            Öffnen
          </button>
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
              <p className="text-sm font-medium text-primary-text">Auswertung</p>
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

            {analysis.values.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                {analysis.values.map((v, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text">{v.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {v.value} {v.unit} · Referenz {v.reference_range}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                        v.status === 'normal' ? 'bg-primary-light text-primary-text' : 'bg-warning-light text-warning'
                      }`}
                    >
                      {valueStatusLabels[v.status as keyof typeof valueStatusLabels] ?? v.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-text-tertiary">Keine Diagnose. Bitte mit deinem Arzt besprechen.</p>
          </div>
        )}

        {analyzeError && <p className="text-sm text-warning">{analyzeError}</p>}

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
