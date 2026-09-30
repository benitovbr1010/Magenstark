// Edge Function: Wochen-Hinweise aus aggregierten Daten per Claude API (SPEC.md §6.3)
// Bekommt vorab aggregierte Statistiken (keine Rohtexte) und liefert vorsichtig formulierte
// Auffälligkeiten + Ernährungsideen. Stateless, kein DB-Zugriff nötig.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const weekInsightsTool = {
  name: 'return_week_insights',
  description: 'Gibt vorsichtig formulierte Auffälligkeiten und Ernährungsideen basierend auf aggregierten Wochendaten zurück.',
  input_schema: {
    type: 'object',
    properties: {
      auffaellig: {
        type: 'array',
        items: { type: 'string' },
        description: 'Max. 3 vorsichtig formulierte Auffälligkeiten, z. B. "könnte zusammenhängen". Leeres Array wenn kein klares Muster erkennbar.',
      },
      ideas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Max. 3 konkrete, umsetzbare Ernährungsideen für die nächste Woche. Leeres Array wenn nicht sinnvoll ableitbar.',
      },
    },
    required: ['auffaellig', 'ideas'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { stats } = await req.json()
    if (!stats) {
      return new Response(JSON.stringify({ error: 'stats fehlt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
          'Du analysierst aggregierte Wochendaten (keine Rohtexte) eines Verdauungstagebuchs. ' +
          'Formuliere Auffälligkeiten immer vorsichtig ("könnte zusammenhängen", "auffällig oft"), nie als Diagnose oder feststehende Tatsache. ' +
          'Nenne konkrete Zahlen aus den Daten, wenn das die Aussage stützt. Ernährungsideen sind konkrete, umsetzbare Vorschläge ' +
          '(z. B. weniger von einem auffälligen Marker, mehr von einem guten Marker). Ton: sachlich, deutsch, kurz. ' +
          'Wenn die Daten kein klares Muster zeigen, gib lieber weniger oder gar keine Hinweise zurück, statt etwas zu erfinden.',
        messages: [
          {
            role: 'user',
            content: `Aggregierte Daten der letzten Wochen:\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
        tools: [weekInsightsTool],
        tool_choice: { type: 'tool', name: 'return_week_insights' },
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

    const input = toolUse.input as { auffaellig: string[]; ideas: string[] }
    const result = {
      auffaellig: (input.auffaellig ?? []).slice(0, 3),
      ideas: (input.ideas ?? []).slice(0, 3),
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
