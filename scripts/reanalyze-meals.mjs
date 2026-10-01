// Einmaliges Migrationsskript: bestehende Mahlzeiten mit der neuen Zutaten-Logik (analyze-meal)
// neu analysieren, damit alte und neue Daten vergleichbar sind (SPEC-Erweiterung, Konsistenz-Fix).
// Aufruf: SUPABASE_SERVICE_ROLE_KEY=... node scripts/reanalyze-meals.mjs
// Der Service-Role-Key wird nur als Umgebungsvariable übergeben, nie im Repo gespeichert.

const SUPABASE_URL = 'https://rvwtwpynnipvivrmgbwp.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY env var fehlt.')
  process.exit(1)
}

async function main() {
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/meals?select=id,raw_text,eaten_at`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  })
  const meals = await listRes.json()
  if (!Array.isArray(meals)) {
    console.error('Konnte Mahlzeiten nicht laden:', meals)
    process.exit(1)
  }
  console.log(`${meals.length} Mahlzeiten gefunden.`)

  let ok = 0
  let failed = 0

  for (const meal of meals) {
    try {
      const analyzeRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-meal`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: meal.raw_text, currentTime: meal.eaten_at }),
      })
      const result = await analyzeRes.json()
      if (!analyzeRes.ok || result.error) {
        console.error(`  Fehler bei ${meal.id}:`, result.error ?? result)
        failed++
        continue
      }

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/meals?id=eq.${meal.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          ingredients: result.ingredients,
          prep_markers: result.prep_markers,
          markers: result.markers,
          good_markers: result.good_markers,
          good_foods: result.good_foods,
          fodmap_sources: result.fodmap_sources,
        }),
      })
      if (!patchRes.ok) {
        console.error(`  Update fehlgeschlagen bei ${meal.id}:`, await patchRes.text())
        failed++
        continue
      }
      ok++
      console.log(`  OK ${meal.id}: ${result.ingredients.join(', ')}`)
    } catch (err) {
      console.error(`  Ausnahme bei ${meal.id}:`, err)
      failed++
    }
  }

  console.log(`Fertig. ${ok} erfolgreich, ${failed} fehlgeschlagen.`)
}

main()
