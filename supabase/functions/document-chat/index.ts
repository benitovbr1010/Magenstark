// Edge Function: Chat zu einem Befund (SPEC.md §4.9)
// Bekommt Titel/Auswertung des Dokuments sowie den bisherigen Verlauf vom Client und antwortet sachlich.
// Schreibt selbst nichts in die DB — der Client speichert Frage + Antwort in document_chats.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { documentTitle, analysisSummary, history, message } = await req.json()
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'message fehlt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const previousMessages = Array.isArray(history)
      ? history.map((entry: { role: 'user' | 'assistant'; content: string }) => ({
          role: entry.role,
          content: entry.content,
        }))
      : []

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 512,
        system:
          `Du beantwortest Fragen zu einem Laborbefund namens "${documentTitle}" für ein persönliches Verdauungstagebuch. ` +
          `Gesamtbild des Befunds: ${analysisSummary ?? 'unbekannt'}. ` +
          'Du erklärst, diagnostizierst aber nie. Zusammenhänge zu Symptomen nur als Frage, nie als Aussage. ' +
          'Ton: sachlich, deutsch, kurz. Bei ernsten Fragen auf den Arzt verweisen.',
        messages: [...previousMessages, { role: 'user', content: message }],
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
    const textBlock = data.content?.find((block: { type: string }) => block.type === 'text')
    const reply = textBlock?.text ?? 'Dazu kann ich gerade keine Antwort geben.'

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unerwarteter Fehler', detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
