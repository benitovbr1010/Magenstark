// Edge Function: Mahlzeit aus Freitext per Claude API auswerten (SPEC.md §6.1)
// Läuft serverseitig auf Supabase, der Anthropic-Key bleibt hier und geht nie ans Frontend.
//
// Konsistenz-Architektur (statt: KI schätzt Marker direkt pro Mahlzeit, was bei identischem Text
// zu unterschiedlichen Ergebnissen führen kann):
// 1) KI erkennt aus dem Text nur Zutaten (inkl. Mengeneinschätzung wenig/normal/viel + ob frittiert/
//    paniert zubereitet) + Zubereitungs-Marker scharf (nur wenn im Text explizit beschrieben) und
//    Metadaten (Typ, Uhrzeit, Zusammenfassung). Dieser Schritt wird über einen Hash des normalisierten
//    Texts gecacht (meal_analysis_cache) – identischer Text liefert immer dieselbe Zutatenliste.
// 2) Jede Zutat wird GENAU EINMAL dauerhaft bewertet (ingredient_profiles, geteiltes Nachschlagewerk).
//    Neue Zutaten werden hier klassifiziert und gespeichert, bekannte Zutaten nie erneut geschätzt.
// 3) Die Marker/Good-Marker/FODMAP-Quellen/guten Zutaten der Mahlzeit werden im Code aus den
//    gespeicherten Zutaten-Profilen zusammengesetzt (Vereinigung), nicht von der KI frei vergeben.
// Fett-Regeln (feste Regeln im CODE statt freier KI-Einschätzung):
// - "gesunde_fette" wird beim Klassifizieren NUR für eine feste Zutatenliste erzwungen (Öle, Nüsse,
//   Samen, Avocado, fetter Fisch) – was die KI vorschlägt, wird dafür überschrieben/gefiltert.
// - "fettreich" (Auslöser) wird NICHT aus ingredient_profiles übernommen, sondern pro Mahlzeit aus der
//   Mengeneinschätzung + Zubereitungsart der Zutaten berechnet: Zubereitung (frittiert/paniert) ODER
//   eine fettreiche Zutat (Käse, Butter, Sahne, Wurst, Speck, Öle, oder die gesunden Fette oben) in
//   GROSSER Menge.
// Beide KI-Aufrufe laufen mit temperature 0 und festem Tool-Schema für maximale Konsistenz.
// Nutzt den Service-Role-Client (umgeht RLS), da ingredient_profiles/meal_analysis_cache keine
// Insert-Policies für Clients haben.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const MEAL_TYPES = ['fruehstueck', 'mittag', 'abend', 'snack'] as const

// Zubereitungs-Marker: Eigenschaft der Zubereitung, nicht einer bestimmten Zutat – werden direkt aus
// dem Text erkannt, nie aus ingredient_profiles übernommen. "fettreich" läuft separat über die
// Mengeneinschätzung pro Zutat (siehe FAT_DENSE_KEYWORDS unten), nicht über diesen Mechanismus.
const PREP_MARKERS = ['scharf'] as const

const INGREDIENT_AMOUNTS = ['wenig', 'normal', 'viel'] as const

// Feste Fett-Regeln: "gesunde_fette" darf nur für diese Zutaten vergeben werden (CODE entscheidet,
// nicht die KI). Wird sowohl beim Klassifizieren neuer Zutaten erzwungen als auch für die
// Mengen-basierte "fettreich"-Entscheidung pro Mahlzeit verwendet (diese Zutaten gelten auch als
// fettreich, nur eben als "gute" Fettquelle).
const HEALTHY_FAT_KEYWORDS = [
  'olivenöl', 'rapsöl', 'leinöl',
  'nuss', 'nüsse', 'mandel', 'walnuss', 'haselnuss', 'cashew', 'pistazie', 'erdnuss', 'macadamia', 'paranuss',
  'samen', 'kerne', 'chiasamen', 'leinsamen', 'kürbiskern', 'sonnenblumenkern', 'hanfsamen',
  'avocado',
  'lachs', 'makrele', 'hering', 'thunfisch', 'sardine', 'forelle',
]
const OTHER_FAT_DENSE_KEYWORDS = [
  'öl', 'käse', 'butter', 'sahne', 'creme fraiche', 'crème fraîche', 'mascarpone',
  'wurst', 'speck', 'bacon', 'salami', 'schmalz', 'margarine', 'mayonnaise', 'majo',
  'kokosmilch', 'kokosöl',
]

function isHealthyFatIngredient(name: string): boolean {
  return HEALTHY_FAT_KEYWORDS.some((kw) => name.includes(kw))
}

function isFatDenseIngredient(name: string): boolean {
  return isHealthyFatIngredient(name) || OTHER_FAT_DENSE_KEYWORDS.some((kw) => name.includes(kw))
}

// Marker, die einer Zutat zugeordnet werden (alle MARKERS aus constants.ts außer den Prep-Markern).
const INGREDIENT_MARKERS = [
  'gluten',
  'laktose',
  'fodmap_hoch',
  'zuckeraustausch',
  'viel_zucker',
  'rotes_fleisch',
  'verarbeitetes_fleisch',
  'stark_verarbeitet',
  'kaffee',
  'alkohol',
  'kohlensaeure',
] as const

// good_markers, die einer Zutat zugeordnet werden (alle GOOD_MARKERS aus constants.ts außer
// ausreichend_getrunken, das über das separate Wassertracking läuft, nicht über Zutaten).
const INGREDIENT_GOOD_MARKERS = ['ballaststoffe', 'gemuese', 'obst_fodmap_arm', 'fermentiert', 'gesunde_fette'] as const

const FODMAP_TYPES = ['fruktane', 'laktose', 'fruktose', 'polyole', 'gos'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const extractionTool = {
  name: 'return_meal_extraction',
  description: 'Zerlegt eine Mahlzeitenbeschreibung in Metadaten und eine normalisierte Zutatenliste.',
  input_schema: {
    type: 'object',
    properties: {
      meal_type: { type: 'string', enum: MEAL_TYPES as unknown as string[] },
      eaten_at_hint: { type: ['string', 'null'], description: 'Uhrzeit als HH:MM falls im Text genannt, sonst null' },
      summary: { type: 'string', description: 'Kurzbeschreibung der Mahlzeit, ein Satz' },
      main_foods: { type: 'array', items: { type: 'string' }, description: 'Hauptzutaten/Lebensmittel, max 6, für die Anzeige' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                'Normalisierter, kleingeschriebener Einzahl-Zutatenname (z. B. "zwiebel", "weizennudeln", "rinderhack").',
            },
            amount: {
              type: 'string',
              enum: INGREDIENT_AMOUNTS as unknown as string[],
              description: 'Grobe Mengeneinschätzung DIESER Zutat in der Mahlzeit. Bei Unsicherheit "normal".',
            },
            fried: {
              type: 'boolean',
              description:
                'Nur true, wenn der Text EXPLIZIT beschreibt, dass genau diese Zutat frittiert/paniert/in reichlich Öl gebraten wurde. Nicht raten.',
            },
          },
          required: ['name', 'amount', 'fried'],
        },
        description:
          'Zutaten inkl. typischer versteckter Zutaten (z. B. Bolognese → zwiebel, knoblauch, tomate, hackfleisch, öl). Max 15, keine Duplikate.',
      },
      prep_markers: {
        type: 'array',
        items: { type: 'string', enum: PREP_MARKERS as unknown as string[] },
        description: 'Nur setzen, wenn der Text EXPLIZIT scharf gewürzt/scharfe Sauce/Chili beschreibt. Nicht raten.',
      },
    },
    required: ['meal_type', 'eaten_at_hint', 'summary', 'main_foods', 'ingredients', 'prep_markers'],
  },
}

const classifyIngredientsTool = {
  name: 'return_ingredient_profiles',
  description:
    'Bewertet jede übergebene Zutat unabhängig von einer konkreten Mahlzeit mit allgemeingültigen, dauerhaft gültigen Markern.',
  input_schema: {
    type: 'object',
    properties: {
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            markers: { type: 'array', items: { type: 'string', enum: INGREDIENT_MARKERS as unknown as string[] } },
            good_markers: { type: 'array', items: { type: 'string', enum: INGREDIENT_GOOD_MARKERS as unknown as string[] } },
            fodmap_types: {
              type: 'array',
              items: { type: 'string', enum: FODMAP_TYPES as unknown as string[] },
              description: 'Nur befüllen, wenn markers fodmap_hoch enthält.',
            },
            note: { type: ['string', 'null'], description: 'Optionale kurze Begründung, sonst null' },
          },
          required: ['name', 'markers', 'good_markers', 'fodmap_types', 'note'],
        },
      },
    },
    required: ['ingredients'],
  },
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function callClaude(system: string, userContent: string, tool: Record<string, unknown>) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1536,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: userContent }],
      tools: [tool],
      tool_choice: { type: 'tool', name: (tool as { name: string }).name },
    }),
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API Fehler: ${errText}`)
  }
  const data = await response.json()
  const toolUse = data.content?.find((block: { type: string }) => block.type === 'tool_use')
  if (!toolUse) throw new Error('Keine Auswertung erhalten')
  return toolUse.input
}

type IngredientExtraction = { name: string; amount: (typeof INGREDIENT_AMOUNTS)[number]; fried: boolean }

type Extraction = {
  meal_type: string
  eaten_at_hint: string | null
  summary: string
  main_foods: string[]
  ingredients: IngredientExtraction[]
  prep_markers: string[]
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

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const normalizedText = normalizeText(text)
    const textHash = await sha256Hex(normalizedText)

    const { data: cachedRow } = await supabaseAdmin
      .from('meal_analysis_cache')
      .select('result')
      .eq('text_hash', textHash)
      .maybeSingle()

    let extraction: Extraction

    if (cachedRow) {
      extraction = cachedRow.result as Extraction
    } else {
      const input = (await callClaude(
        'Du zerlegst kurze deutsche Freitext-Beschreibungen von Mahlzeiten für ein Verdauungstagebuch in Metadaten und eine ' +
          'normalisierte Zutatenliste mit Mengeneinschätzung. Nimm typische (auch versteckte) Zutaten realistisch an (z. B. ' +
          'Bolognese enthält meist Zwiebel, Knoblauch, Tomate, Hackfleisch, Öl), aber erfinde bei echter Unsicherheit keine ' +
          'Zutaten. Zutatennamen immer kleingeschrieben und in der Grundform (z. B. "zwiebel" statt "Zwiebeln"). Schätze pro ' +
          'Zutat die Menge in der Mahlzeit ein (wenig/normal/viel) und setze "fried" nur, wenn der Text explizit beschreibt, ' +
          'dass genau diese Zutat frittiert/paniert/in reichlich Öl gebraten wurde. Den Zubereitungs-Marker "scharf" nur setzen, ' +
          'wenn der Text das wirklich explizit beschreibt. Ton: sachlich, kurz.',
        `Aktuelle Uhrzeit: ${currentTime}\n\nText: "${text}"`,
        extractionTool,
      )) as Extraction

      const seenIngredientNames = new Set<string>()
      const ingredients: IngredientExtraction[] = []
      for (const raw of input.ingredients ?? []) {
        const name = normalizeIngredientName((raw as { name?: string }).name ?? '')
        if (!name || seenIngredientNames.has(name)) continue
        seenIngredientNames.add(name)
        const amount = INGREDIENT_AMOUNTS.includes((raw as IngredientExtraction).amount) ? (raw as IngredientExtraction).amount : 'normal'
        ingredients.push({ name, amount, fried: Boolean((raw as IngredientExtraction).fried) })
        if (ingredients.length >= 15) break
      }

      extraction = {
        meal_type: MEAL_TYPES.includes(input.meal_type as (typeof MEAL_TYPES)[number]) ? input.meal_type : 'snack',
        eaten_at_hint: input.eaten_at_hint ?? null,
        summary: input.summary,
        main_foods: (input.main_foods ?? []).slice(0, 6),
        ingredients,
        prep_markers: (input.prep_markers ?? []).filter((m) => PREP_MARKERS.includes(m as (typeof PREP_MARKERS)[number])),
      }

      await supabaseAdmin
        .from('meal_analysis_cache')
        .upsert({ text_hash: textHash, raw_text: normalizedText, result: extraction }, { onConflict: 'text_hash', ignoreDuplicates: true })
    }

    // 2) Fehlende Zutaten-Profile nachladen/klassifizieren.
    const ingredientNames = extraction.ingredients.map((i) => i.name)
    const existingProfiles: Record<string, { markers: string[]; good_markers: string[]; fodmap_types: string[] }> = {}

    if (ingredientNames.length > 0) {
      const { data: profileRows } = await supabaseAdmin
        .from('ingredient_profiles')
        .select('name, markers, good_markers, fodmap_types')
        .in('name', ingredientNames)
      for (const row of profileRows ?? []) {
        existingProfiles[row.name] = { markers: row.markers, good_markers: row.good_markers, fodmap_types: row.fodmap_types }
      }
    }

    const missingNames = ingredientNames.filter((n) => !existingProfiles[n])

    if (missingNames.length > 0) {
      const classifyInput = (await callClaude(
        'Du bewertest einzelne Lebensmittel-Zutaten für ein Verdauungstagebuch mit allgemeingültigen, von der konkreten Mahlzeit ' +
          'unabhängigen Eigenschaften (z. B. "zwiebel" ist immer fodmap_hoch, unabhängig davon in welchem Gericht sie vorkommt). ' +
          'Setze fodmap_types nur, wenn markers fodmap_hoch enthält. Setze bei echter Unsicherheit lieber keinen Marker statt zu raten. ' +
          'Ton: sachlich, kurz.',
        `Bewerte folgende Zutaten: ${missingNames.join(', ')}`,
        classifyIngredientsTool,
      )) as { ingredients: { name: string; markers: string[]; good_markers: string[]; fodmap_types: string[]; note: string | null }[] }

      const newProfiles = (classifyInput.ingredients ?? []).map((c) => {
        const name = normalizeIngredientName(c.name)
        // "gesunde_fette" ist eine feste Regel (CODE entscheidet), nicht die Einschätzung der KI:
        // nur für die feste Zutatenliste erzwingen, sonst entfernen – egal was die KI vorschlägt.
        const goodMarkers = (c.good_markers ?? []).filter(
          (m) => INGREDIENT_GOOD_MARKERS.includes(m as (typeof INGREDIENT_GOOD_MARKERS)[number]) && m !== 'gesunde_fette',
        )
        if (isHealthyFatIngredient(name)) goodMarkers.push('gesunde_fette')
        return {
          name,
          markers: (c.markers ?? []).filter((m) => INGREDIENT_MARKERS.includes(m as (typeof INGREDIENT_MARKERS)[number])),
          good_markers: goodMarkers,
          fodmap_types: (c.fodmap_types ?? []).filter((f) => FODMAP_TYPES.includes(f as (typeof FODMAP_TYPES)[number])),
          note: c.note ?? null,
        }
      })

      // Zutaten, die die KI bei der Klassifizierung evtl. ausgelassen hat, trotzdem mit leerem Profil anlegen,
      // damit sie beim nächsten Mal nicht erneut als "fehlend" gelten.
      const classifiedNames = new Set(newProfiles.map((p) => p.name))
      for (const name of missingNames) {
        if (!classifiedNames.has(name)) {
          newProfiles.push({ name, markers: [], good_markers: [], fodmap_types: [], note: null })
        }
      }

      if (newProfiles.length > 0) {
        await supabaseAdmin.from('ingredient_profiles').upsert(newProfiles, { onConflict: 'name', ignoreDuplicates: true })
      }

      const { data: refetched } = await supabaseAdmin
        .from('ingredient_profiles')
        .select('name, markers, good_markers, fodmap_types')
        .in('name', missingNames)
      for (const row of refetched ?? []) {
        existingProfiles[row.name] = { markers: row.markers, good_markers: row.good_markers, fodmap_types: row.fodmap_types }
      }
    }

    // 3) Marker/Good-Marker/FODMAP-Quellen/gute Zutaten im Code aus den Zutaten-Profilen zusammensetzen.
    const markerSet = new Set<string>(extraction.prep_markers)
    const goodMarkerSet = new Set<string>()
    const fodmapSources: string[] = []
    const goodFoods: string[] = []

    for (const name of ingredientNames) {
      const profile = existingProfiles[name]
      if (!profile) continue
      for (const m of profile.markers) markerSet.add(m)
      for (const g of profile.good_markers) goodMarkerSet.add(g)
      if (profile.markers.includes('fodmap_hoch')) fodmapSources.push(name)
      if (profile.good_markers.length > 0) goodFoods.push(name)
    }

    // "fettreich" ist keine Eigenschaft des Zutaten-Profils, sondern hängt von Menge/Zubereitung IN
    // DIESER Mahlzeit ab: Zubereitung (frittiert/paniert) ODER fettreiche Zutat in großer Menge.
    const ingredientDetails: Record<string, { amount: string; fried: boolean }> = {}
    for (const ing of extraction.ingredients) {
      ingredientDetails[ing.name] = { amount: ing.amount, fried: ing.fried }
      if (ing.fried || (ing.amount === 'viel' && isFatDenseIngredient(ing.name))) {
        markerSet.add('fettreich')
      }
    }

    const result = {
      meal_type: extraction.meal_type,
      eaten_at_hint: extraction.eaten_at_hint,
      summary: extraction.summary,
      main_foods: extraction.main_foods,
      ingredients: ingredientNames,
      ingredient_details: ingredientDetails,
      prep_markers: extraction.prep_markers,
      markers: Array.from(markerSet),
      good_markers: Array.from(goodMarkerSet),
      good_foods: goodFoods,
      fodmap_sources: fodmapSources,
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
