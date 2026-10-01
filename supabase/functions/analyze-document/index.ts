// Edge Function: Laborbefund (PDF/Foto, ggf. mehrere Bilder/Dokumente einer Untersuchung) per Claude API
// auswerten (SPEC.md §6.2, erweitert um persönliche Ansprache, Zitate, getrennte Status-Typen,
// Untersuchungs-Gruppierung). Lädt die Datei(en) über den Nutzer-Client (RLS greift), schickt sie an
// Claude, gibt strukturiertes JSON zurück. Schreibt selbst nichts in die DB — das übernimmt der Client.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const LAB_STATUS = ['niedrig', 'normal', 'hoch']
const FINDING_STATUS = ['unauffaellig', 'auffaellig']

// Gleiche Symptom-Spalten wie src/lib/constants.ts (symptomLabels) — hier dupliziert, da Edge Functions
// nicht auf src/ zugreifen können.
const SYMPTOM_LABELS: Record<string, string> = {
  abdominal_pain: 'Bauchschmerzen',
  bloating: 'Blähungen',
  nausea: 'Übelkeit',
  fullness: 'Völlegefühl',
  urgency: 'Stuhldrang',
  stress: 'Stress',
  rumbling: 'Rumpeln/Darmgeräusche',
  heartburn: 'Sodbrennen',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const analyzeDocumentTool = {
  name: 'return_document_analysis',
  description:
    'Gibt die strukturierte, persönliche Auswertung eines oder mehrerer zusammengehöriger Befund-Dokumente zurück.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: '2-3 Sätze in Du-Form: was steht in deinem Befund. Persönlich formuliert, nie "bei einer...".',
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Verständlicher Name des Befunds/Werts' },
            quote: { type: 'string', description: 'Wörtliches Zitat aus dem Dokument, zum Nachprüfen' },
            explanation: { type: 'string', description: 'Ein Satz in einfacher Sprache: was das bedeutet' },
            kind: {
              type: 'string',
              enum: ['lab', 'finding'],
              description: 'lab = Laborwert mit Zahl, finding = Text-/Gewebebefund',
            },
            status: {
              type: 'string',
              enum: [...LAB_STATUS, ...FINDING_STATUS],
              description: 'Bei kind=lab: niedrig/normal/hoch. Bei kind=finding: unauffaellig/auffaellig.',
            },
            value: { type: 'string', description: 'Nur bei kind=lab: gemessener Wert' },
            unit: { type: 'string', description: 'Nur bei kind=lab: Einheit' },
            reference_range: { type: 'string', description: 'Nur bei kind=lab: Referenzbereich' },
          },
          required: ['name', 'quote', 'explanation', 'kind', 'status'],
        },
        description: 'Einzelbefunde, max 10. Keine Untersuchungsdaten (Puls, Narkose, Gerät) hier einordnen.',
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Die Empfehlung in eigenen, verständlichen Worten' },
            quote: { type: 'string', description: 'Wörtliches Zitat aus dem Dokument' },
          },
          required: ['text', 'quote'],
        },
        description:
          'Nur Empfehlungen, die wörtlich im Dokument stehen (z. B. PPI-Versuch, Ernährungstagebuch, Ultraschall, Kontrollintervall).',
      },
      missing_info: {
        type: 'array',
        items: { type: 'string' },
        description: 'Wichtige Angaben, die im Dokument fehlen oder unklar sind.',
      },
      additional_info: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, value: { type: 'string' } },
          required: ['name', 'value'],
        },
        description:
          'Reine Untersuchungsdaten ohne medizinische Bewertung: Puls, Sauerstoffsättigung, Narkose, Gerät, Assistenz usw.',
      },
      questions: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Max 3 kurze Fragen, die DU (der Nutzer) dem Arzt stellst, in Ich-Form, z. B. "Was könnte bei mir die Ursache von X sein?". Nie Fragen, die der Arzt dir stellen würde.',
      },
    },
    required: ['summary', 'findings', 'recommendations', 'missing_info', 'additional_info', 'questions'],
  },
}

type DocumentRow = {
  id: string
  title: string
  user_id: string
  file_path: string
  file_paths: string[] | null
  examination_id: string | null
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { documentId } = await req.json()
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId fehlt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single<DocumentRow>()
    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Dokument nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Gehört das Dokument zu einer Untersuchung, alle zugehörigen Dokumente gemeinsam laden & auswerten.
    let groupDocs: DocumentRow[] = [doc]
    if (doc.examination_id) {
      const { data: groupRows } = await supabase
        .from('documents')
        .select('*')
        .eq('examination_id', doc.examination_id)
        .order('created_at', { ascending: true })
      if (groupRows && groupRows.length > 0) groupDocs = groupRows as DocumentRow[]
    }

    const contentBlocks = []
    for (const groupDoc of groupDocs) {
      const filePaths = groupDoc.file_paths?.length ? groupDoc.file_paths : [groupDoc.file_path]
      for (const filePath of filePaths) {
        const { data: fileBlob, error: downloadError } = await supabase.storage.from('documents').download(filePath)
        if (downloadError || !fileBlob) {
          return new Response(JSON.stringify({ error: 'Datei konnte nicht geladen werden' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const extension = filePath.split('.').pop()?.toLowerCase() ?? ''
        const isPdf = extension === 'pdf'
        const mediaType = isPdf
          ? 'application/pdf'
          : extension === 'png'
            ? 'image/png'
            : extension === 'webp'
              ? 'image/webp'
              : 'image/jpeg'

        const base64 = arrayBufferToBase64(await fileBlob.arrayBuffer())
        contentBlocks.push(
          isPdf
            ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        )
      }
    }

    // Beschwerden der letzten 4 Wochen als optionaler Kontext für sinnvollere Arztfragen.
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
    const { data: wellbeingRows } = await supabase
      .from('wellbeing')
      .select('abdominal_pain,bloating,nausea,fullness,urgency,stress,rumbling,heartburn')
      .eq('user_id', doc.user_id)
      .gte('occurred_at', fourWeeksAgo)

    let symptomContext = ''
    if (wellbeingRows && wellbeingRows.length > 0) {
      const symptomKeys = Object.keys(SYMPTOM_LABELS)
      const averages = symptomKeys
        .map((key) => {
          const values = wellbeingRows.map((row: Record<string, number>) => row[key] ?? 0)
          const avg = values.reduce((sum: number, v: number) => sum + v, 0) / values.length
          return { label: SYMPTOM_LABELS[key], avg }
        })
        .filter((s) => s.avg > 0)
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
      if (averages.length > 0) {
        symptomContext = `Deine Beschwerden der letzten 4 Wochen (Ø 0-10): ${averages
          .map((s) => `${s.label} ${s.avg.toFixed(1)}`)
          .join(', ')}.`
      }
    }

    const titles = groupDocs.map((d) => d.title).join(', ')
    const documentCountText =
      contentBlocks.length > 1
        ? `Dies sind ${contentBlocks.length} Bilder/Seiten ${groupDocs.length > 1 ? `aus ${groupDocs.length} zusammengehörigen Dokumenten (${titles})` : `desselben Befunds ("${doc.title}")`}. Werte sie zusammen als eine Untersuchung aus.`
        : `Titel: ${doc.title}.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        temperature: 0,
        system:
          'Du erklärst medizinische Befunde für ein persönliches Verdauungstagebuch, sachlich und auf Deutsch. ' +
          'Sprich den Nutzer IMMER persönlich in der Du-Form an und beziehe dich auf SEINEN Befund, z. B. ' +
          '"In deiner Magenspiegelung vom 31.05.2024 wurden..." statt "bei einer Magenspiegelung". ' +
          'Einfache Sprache; Fachbegriffe immer in Klammern erklären. ' +
          'Du diagnostizierst nie, sondern erklärst nur, was im Dokument steht. ' +
          'WICHTIG: Erfinde nichts. Jeder Einzelbefund und jede Empfehlung braucht ein wörtliches Zitat aus dem Dokument. ' +
          'Wenn eine Stelle unleserlich ist, schreibe das explizit ("Konnte ich nicht sicher lesen") statt zu raten. ' +
          'Unterscheide bei Einzelbefunden: Laborwerte mit Zahl bekommen den Status niedrig/normal/hoch mit Wert und ' +
          'Referenzbereich. Text- und Gewebebefunde (z. B. Histologie, Biopsie) bekommen nur unauffaellig oder auffaellig, ' +
          'NIE "knapp hoch" oder ähnliche Zwischenstufen. ' +
          'Reine Untersuchungsdaten wie Puls, Sauerstoffsättigung, Narkosemittel, verwendetes Gerät oder Assistenzpersonal ' +
          'sind KEINE Befunde — ordne sie ausschließlich additional_info zu, ohne Status oder Bewertung. ' +
          'Empfehlungen nur übernehmen, wenn sie wörtlich im Dokument stehen (z. B. PPI-Versuch, Ernährungstagebuch, ' +
          'Ultraschall, Kontrollintervall). ' +
          'Formuliere die Fragen in questions immer aus Sicht des Nutzers, der sie dem Arzt stellt (Ich-Form), ' +
          'z. B. "Was könnte bei mir die Ursache von X sein?" — nie umgekehrt. Beziehe sie, wenn sinnvoll, auf die ' +
          'mitgelieferten eigenen Beschwerden der letzten 4 Wochen. Zusammenhänge zu Symptomen nur als Frage, nie als Aussage.',
        messages: [
          {
            role: 'user',
            content: [
              ...contentBlocks,
              {
                type: 'text',
                text: `${documentCountText} Werte diesen Befund aus.${symptomContext ? ` ${symptomContext}` : ''}`,
              },
            ],
          },
        ],
        tools: [analyzeDocumentTool],
        tool_choice: { type: 'tool', name: 'return_document_analysis' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return new Response(JSON.stringify({ error: 'Anthropic API Fehler', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const toolUse = data.content?.find((block: { type: string }) => block.type === 'tool_use')
    if (!toolUse) {
      return new Response(JSON.stringify({ error: 'Keine Auswertung erhalten' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const input = toolUse.input as {
      summary: string
      findings: {
        name: string
        quote: string
        explanation: string
        kind: string
        status: string
        value?: string
        unit?: string
        reference_range?: string
      }[]
      recommendations: { text: string; quote: string }[]
      missing_info: string[]
      additional_info: { name: string; value: string }[]
      questions: string[]
    }

    const result = {
      summary: input.summary,
      findings: (input.findings ?? [])
        .filter(
          (f) =>
            (f.kind === 'lab' && LAB_STATUS.includes(f.status)) ||
            (f.kind === 'finding' && FINDING_STATUS.includes(f.status)),
        )
        .slice(0, 10),
      recommendations: (input.recommendations ?? []).slice(0, 5),
      missing_info: (input.missing_info ?? []).slice(0, 5),
      additional_info: (input.additional_info ?? []).slice(0, 10),
      questions: (input.questions ?? []).slice(0, 3),
      documentIds: groupDocs.map((d) => d.id),
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unerwarteter Fehler', detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
