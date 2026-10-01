// Edge Function: Mahlzeit aus Freitext per Claude API auswerten (SPEC.md §6.1)
// Läuft serverseitig auf Supabase, der Anthropic-Key bleibt hier und geht nie ans Frontend.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const MEAL_TYPES = ['fruehstueck', 'mittag', 'abend', 'snack'] as const
const MARKERS = [
  'gluten',
  'laktose',
  'fodmap_hoch',
  'zuckeraustausch',
  'viel_zucker',
  'fettig_frittiert',
  'scharf',
  'rotes_fleisch',
  'verarbeitetes_fleisch',
  'stark_verarbeitet',
  'kaffee',
  'alkohol',
  'kohlensaeure',
] as const
const GOOD_MARKERS = ['ballaststoffe', 'gemuese', 'obst_fodmap_arm', 'fermentiert', 'gesunde_fette', 'ausreichend_getrunken'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const analyzeMealTool = {
  name: 'return_meal_analysis',
  description: 'Gibt die strukturierte Auswertung einer beschriebenen Mahlzeit zurück.',
  input_schema: {
    type: 'object',
    properties: {
      meal_type: { type: 'string', enum: MEAL_TYPES as unknown as string[] },
      eaten_at_hint: { type: ['string', 'null'], description: 'Uhrzeit als HH:MM falls im Text genannt, sonst null' },
      summary: { type: 'string', description: 'Kurzbeschreibung der Mahlzeit, ein Satz' },
      main_foods: { type: 'array', items: { type: 'string' }, description: 'Hauptzutaten/Lebensmittel, max 6' },
      markers: { type: 'array', items: { type: 'string', enum: MARKERS as unknown as string[] } },
      good_markers: { type: 'array', items: { type: 'string', enum: GOOD_MARKERS as unknown as string[] } },
      good_foods: {
        type: 'array',
        items: { type: 'string' },
        description: 'Konkrete gut verträgliche Zutaten aus der Mahlzeit, z. B. Haferflocken, Karotte, Reis, Flohsamen (nicht nur Kategorien)',
      },
      fodmap_sources: { type: 'array', items: { type: 'string' }, description: 'Konkrete FODMAP-Quellen falls fodmap_hoch gesetzt ist' },
    },
    required: ['meal_type', 'eaten_at_hint', 'summary', 'main_foods', 'markers', 'good_markers', 'good_foods', 'fodmap_sources'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, currentTime } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text fehlt' }), {
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
          'Du wertest kurze deutsche Freitext-Beschreibungen von Mahlzeiten für ein Verdauungstagebuch aus. ' +
          'Nimm typische Zutaten realistisch an (z. B. Bolognese enthält meist Zwiebel/Knoblauch), aber setze bei ' +
          'Unsicherheit lieber keinen Marker statt zu raten. ' +
          'Nenne bei good_foods konkrete, namentlich erkennbare gut verträgliche Zutaten aus der Mahlzeit (z. B. Haferflocken, ' +
          'Karotte, Reis, Flohsamen, Banane, Kiwi, Joghurt) statt nur allgemeiner Kategorien. Wenn keine solchen Zutaten ' +
          'erkennbar sind, lass good_foods leer. Ton: sachlich, kurz.',
        messages: [
          {
            role: 'user',
            content: `Aktuelle Uhrzeit: ${currentTime}\n\nText: "${text}"`,
          },
        ],
        tools: [analyzeMealTool],
        tool_choice: { type: 'tool', name: 'return_meal_analysis' },
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
      meal_type: string
      eaten_at_hint: string | null
      summary: string
      main_foods: string[]
      markers: string[]
      good_markers: string[]
      good_foods: string[]
      fodmap_sources: string[]
    }

    const result = {
      meal_type: MEAL_TYPES.includes(input.meal_type as (typeof MEAL_TYPES)[number]) ? input.meal_type : 'snack',
      eaten_at_hint: input.eaten_at_hint ?? null,
      summary: input.summary,
      main_foods: (input.main_foods ?? []).slice(0, 6),
      markers: (input.markers ?? []).filter((m) => MARKERS.includes(m as (typeof MARKERS)[number])),
      good_markers: (input.good_markers ?? []).filter((m) => GOOD_MARKERS.includes(m as (typeof GOOD_MARKERS)[number])),
      good_foods: input.good_foods ?? [],
      fodmap_sources: input.fodmap_sources ?? [],
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
