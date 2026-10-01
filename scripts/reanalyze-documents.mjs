// Einmaliges Migrationsskript: bestehende Befund-Dokumente mit der neuen Auswertungs-Logik
// (persönliche Ansprache, Zitate, getrennte Status-Typen, Untersuchungs-Gruppierung) neu auswerten.
// Aufruf: SUPABASE_SERVICE_ROLE_KEY=... node scripts/reanalyze-documents.mjs
// Der Service-Role-Key wird nur als Umgebungsvariable übergeben, nie im Repo gespeichert.

const SUPABASE_URL = 'https://rvwtwpynnipvivrmgbwp.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY env var fehlt.')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function main() {
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/documents?select=id,user_id,examination_id`, { headers })
  const documents = await listRes.json()
  if (!Array.isArray(documents)) {
    console.error('Konnte Dokumente nicht laden:', documents)
    process.exit(1)
  }
  console.log(`${documents.length} Dokumente gefunden.`)

  // Gruppieren: ein Aufruf pro Untersuchungs-Gruppe (bzw. pro einzelnem Dokument ohne Gruppe).
  const seen = new Set()
  const representatives = []
  for (const doc of documents) {
    const groupKey = doc.examination_id ?? `doc:${doc.id}`
    if (seen.has(groupKey)) continue
    seen.add(groupKey)
    representatives.push(doc)
  }
  console.log(`${representatives.length} Gruppen (inkl. Einzeldokumente) werden ausgewertet.`)

  let ok = 0
  let failed = 0

  for (const doc of representatives) {
    try {
      const analyzeRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-document`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ documentId: doc.id }),
      })
      const result = await analyzeRes.json()
      if (!analyzeRes.ok || result.error) {
        console.error(`  Fehler bei ${doc.id}:`, result.error ?? result)
        failed++
        continue
      }

      const { documentIds, ...analysis } = result
      const targetIds = documentIds?.length ? documentIds : [doc.id]
      const idsList = targetIds.join(',')

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/documents?id=in.(${idsList})`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ analysis }),
      })
      if (!patchRes.ok) {
        console.error(`  Update fehlgeschlagen bei ${doc.id}:`, await patchRes.text())
        failed++
        continue
      }

      await fetch(`${SUPABASE_URL}/rest/v1/doctor_questions?document_id=in.(${idsList})`, {
        method: 'DELETE',
        headers: { ...headers, Prefer: 'return=minimal' },
      })

      if (analysis.questions?.length > 0) {
        const rows = targetIds.flatMap((docId) =>
          analysis.questions.map((text) => ({ user_id: doc.user_id, document_id: docId, text, saved: false })),
        )
        await fetch(`${SUPABASE_URL}/rest/v1/doctor_questions`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(rows),
        })
      }

      ok++
      console.log(`  OK ${doc.id} (${targetIds.length} Dokument(e) in Gruppe)`)
    } catch (err) {
      console.error(`  Ausnahme bei ${doc.id}:`, err)
      failed++
    }
  }

  console.log(`Fertig. ${ok} erfolgreich, ${failed} fehlgeschlagen.`)
}

main()
