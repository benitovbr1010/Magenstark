// Edge Function: Laborbefund (PDF/Foto) per Claude API auswerten (SPEC.md §6.2)
// Lädt die Datei über den Nutzer-Client (RLS greift), schickt sie an Claude, gibt strukturiertes JSON zurück.
// Schreibt selbst nichts in die DB — das übernimmt der Client (wie bei analyze-meal).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const STATUS_VALUES = ['niedrig', 'knapp_niedrig', 'normal', 'knapp_hoch', 'hoch'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const analyzeDocumentTool = {
  name: 'return_document_analysis',
  description: 'Gibt die strukturierte Auswertung eines Laborbefunds zurück.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Ein Satz Gesamtbild, erklärend, nicht diagnostizierend' },
      values: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            unit: { type: 'string' },
            reference_range: { type: 'string' },
            status: { type: 'string', enum: STATUS_VALUES as unknown as string[] },
          },
          required: ['name', 'value', 'unit', 'reference_range', 'status'],
        },
        description: 'Nur auffällige Werte, max 8',
      },
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: '1-3 offen formulierte Fragen für den Arzt',
      },
    },
    required: ['summary', 'values', 'questions'],
  },
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

    const { data: doc, error: docError } = await supabase.from('documents').select('*').eq('id', documentId).single()
    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Dokument nicht gefunden' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage.from('documents').download(doc.file_path)
    if (downloadError || !fileBlob) {
      return new Response(JSON.stringify({ error: 'Datei konnte nicht geladen werden' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const extension = doc.file_path.split('.').pop()?.toLowerCase() ?? ''
    const isPdf = extension === 'pdf'
    const mediaType = isPdf
      ? 'application/pdf'
      : extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg'

    const base64 = arrayBufferToBase64(await fileBlob.arrayBuffer())
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

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
        max_tokens: 1536,
        system:
          'Du erklärst medizinische Befunde für ein persönliches Verdauungstagebuch, sachlich und auf Deutsch. ' +
          'Du diagnostizierst nie, sondern erklärst nur, was die Werte bedeuten. ' +
          'Formuliere Fragen für den Arzt offen; Zusammenhänge zu Symptomen nur als Frage, nie als Aussage.',
        messages: [
          {
            role: 'user',
            content: [contentBlock, { type: 'text', text: `Titel: ${doc.title}. Werte diesen Befund aus.` }],
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
      values: { name: string; value: string; unit: string; reference_range: string; status: string }[]
      questions: string[]
    }

    const result = {
      summary: input.summary,
      values: (input.values ?? [])
        .filter((v) => STATUS_VALUES.includes(v.status as (typeof STATUS_VALUES)[number]))
        .slice(0, 8),
      questions: (input.questions ?? []).slice(0, 3),
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
