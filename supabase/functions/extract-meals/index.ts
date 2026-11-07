// Edge Function: Zerlegt Freitext/Sprachtranskript und/oder Screenshots (z. B. aus einer anderen
// Tracking-App) in einzelne Mahlzeiten-Rohbeschreibungen mit Typ- und Uhrzeit-Schätzung.
//
// Macht bewusst KEINE Zutaten-/Marker-Analyse (das bleibt analyze-meal vorbehalten, inkl. dessen
// Caching/Ingredient-Profile-Architektur) — der Client ruft für jedes zurückgegebene Segment
// anschließend ganz normal analyze-meal mit dem Text auf. Schreibt nichts in die DB (stateless wie
// analyze-document), braucht daher keinen Supabase-Client.

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const MEAL_TYPES = ['fruehstueck', 'mittag', 'abend', 'snack'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const extractTool = {
  name: 'return_meal_segments',
  description: 'Zerlegt die Eingabe (Text und/oder Screenshots) in einzelne, in sich verständliche Mahlzeiten.',
  input_schema: {
    type: 'object',
    properties: {
      segments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            meal_type: { type: 'string', enum: MEAL_TYPES as unknown as string[] },
            time_hint: {
              type: ['string', 'null'],
              description: 'Uhrzeit als HH:MM, falls im Text/Screenshot erkennbar oder genannt, sonst null',
            },
            text: {
              type: 'string',
              description:
                'Kurze, in sich verständliche deutsche Beschreibung dieser EINEN Mahlzeit (Zutaten, Zubereitung), so ' +
                'wie ein Nutzer sie selbst eintippen würde, z. B. "Toast mit Käse, Butter, Mayo und Kochschinken".',
            },
          },
          required: ['meal_type', 'time_hint', 'text'],
        },
        description: 'Eine Mahlzeit pro Eintrag. Ein Screenshot oder Text kann mehrere Mahlzeiten enthalten. Max 20.',
      },
    },
    required: ['segments'],
  },
}

type ImageInput = { data: string; mediaType: string }
type Segment = { meal_type: string; time_hint: string | null; text: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, images, currentTime } = (await req.json()) as {
      text?: string
      images?: ImageInput[]
      currentTime?: string
    }

    const hasText = typeof text === 'string' && text.trim().length > 0
    const hasImages = Array.isArray(images) && images.length > 0
    if (!hasText && !hasImages) {
      return new Response(JSON.stringify({ error: 'text oder images fehlt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contentBlocks: Record<string, unknown>[] = []
    if (hasImages) {
      for (const image of images!.slice(0, 6)) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.data },
        })
      }
    }
    contentBlocks.push({
      type: 'text',
      text:
        `Aktuelle Uhrzeit: ${currentTime ?? new Date().toISOString()}\n\n` +
        (hasText
          ? `Text/Transkript: "${text}"`
          : 'Zerlege die Mahlzeiten aus dem/den Screenshot(s) (z. B. aus einer Ernährungs-Tracking-App).'),
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        temperature: 0,
        system:
          'Du liest Freitext, Sprach-Transkripte oder Screenshots aus Ernährungs-/Fitness-Tracking-Apps für ein ' +
          'Verdauungstagebuch und zerlegst sie in einzelne Mahlzeiten. Ein Screenshot (z. B. ein Tagesverlauf aus ' +
          'einer anderen App) oder ein längerer Text/Transkript kann mehrere Mahlzeiten enthalten ("Frühstück ca. 11 ' +
          'Uhr X, Mittag ca. 13 Uhr Y") — erkenne jede einzeln. Gib pro Mahlzeit eine in sich verständliche, kurze ' +
          'deutsche Zutaten-Beschreibung zurück, keine Rohdaten-Dumps. Erfinde keine Mahlzeiten, die nicht klar ' +
          'erkennbar sind, und erfinde keine Zutaten, die nicht genannt/zu sehen sind. Uhrzeit nur setzen, wenn sie ' +
          'explizit genannt ist oder im Screenshot steht, sonst null. Bei Unsicherheit beim Mahlzeittyp anhand der ' +
          'Uhrzeit/Bezeichnung schätzen, im Zweifel "snack".',
        messages: [{ role: 'user', content: contentBlocks }],
        tools: [extractTool],
        tool_choice: { type: 'tool', name: 'return_meal_segments' },
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

    const input = toolUse.input as { segments: Segment[] }
    const segments = (input.segments ?? [])
      .filter((s) => s.text && s.text.trim().length > 0)
      .map((s) => ({
        meal_type: MEAL_TYPES.includes(s.meal_type as (typeof MEAL_TYPES)[number]) ? s.meal_type : 'snack',
        time_hint: s.time_hint ?? null,
        text: s.text.trim(),
      }))
      .slice(0, 20)

    return new Response(JSON.stringify({ segments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unerwarteter Fehler', detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
