// Edge Function: Wiederkehrende Muster in Freitext-Notizen eines Zeitraums erkennen (für Arztbericht)
// Bekommt die tatsächlichen Notiz-Texte (anders als week-insights, das nur aggregierte Daten bekommt),
// weil Ähnlichkeiten in Freitext nur semantisch per LLM erkennbar sind. Stateless, kein DB-Zugriff.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const notePatternsTool = {
  name: 'return_note_patterns',
  description: 'Gibt wiederkehrende Beobachtungen/Muster zurück, die in mehreren Notizen ähnlich vorkommen.',
  input_schema: {
    type: 'object',
    properties: {
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Max. 5 kurze, konkrete Beschreibungen wiederkehrender Beobachtungen, die in mehreren Notizen ähnlich auftauchen ' +
          '(z. B. "Mehrfach beschrieben: Toilettengang kurz nach dem ersten Wasser am Morgen"). ' +
          'Nur aufnehmen, wenn das Muster in mindestens zwei verschiedenen Notizen erkennbar ist. ' +
          'Leeres Array, wenn keine echten Wiederholungen erkennbar sind.',
      },
    },
    required: ['patterns'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { notes } = await req.json()
    if (!Array.isArray(notes) || notes.length < 2) {
      return new Response(JSON.stringify({ patterns: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const notesText = (notes as { date: string; type: string; text: string }[])
      .map((n) => `[${n.date} · ${n.type}] ${n.text}`)
      .join('\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system:
          'Du liest kurze deutsche Freitext-Notizen aus einem Verdauungstagebuch (zu Toilettengängen, Befinden und Tagesabschlüssen) ' +
          'und suchst nach wiederkehrenden Beobachtungen oder Mustern, die in MEHREREN Notizen ähnlich formuliert vorkommen ' +
          '(z. B. immer wieder "direkt nach dem Aufstehen/ersten Wasser auf Toilette müssen", "abends öfter Blähungen", ' +
          '"nach Stress schlechter"). Erfinde nichts und nenne nur Muster, die wirklich mehrfach in unterschiedlichen Notizen ' +
          'auftauchen, keine Einzelerwähnungen. Formuliere sachlich und kurz, auf Deutsch, als Beobachtung ("Mehrfach beschrieben: ..."), ' +
          'nie als Diagnose oder Ursachen-Behauptung.',
        messages: [
          {
            role: 'user',
            content: `Notizen des Zeitraums:\n${notesText}`,
          },
        ],
        tools: [notePatternsTool],
        tool_choice: { type: 'tool', name: 'return_note_patterns' },
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
      return new Response(JSON.stringify({ patterns: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const input = toolUse.input as { patterns: string[] }
    const result = { patterns: (input.patterns ?? []).slice(0, 5) }

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
