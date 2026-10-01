import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReportData } from './report'
import { formatLiters } from './water'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: '#15181A', fontFamily: 'Helvetica' },
  headTitle: { fontSize: 16, color: '#3F5A45', marginBottom: 2 },
  headMeta: { fontSize: 9, color: '#5E6663', marginBottom: 10 },
  divider: { borderBottom: '1pt solid #E6E9E7', marginVertical: 8 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, color: '#3F5A45', marginBottom: 4, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: '#5E6663' },
  subLabel: { color: '#5E6663', marginTop: 4, marginBottom: 2 },
  value: { color: '#15181A' },
  table: { flexDirection: 'row', marginTop: 2 },
  tableCell: { flex: 1, textAlign: 'center', borderTop: '1pt solid #E6E9E7', paddingTop: 2 },
})

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DoctorReportDocument({ data }: { data: ReportData }) {
  const { profile } = data
  const hasGeneral = Boolean(profile?.symptoms_since || profile?.medications)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.headTitle}>Verdauungstagebuch · Verlaufsbericht</Text>
        <Text style={styles.headMeta}>
          Zeitraum: {formatDate(data.from)} – {formatDate(data.to)}
          {profile?.name ? `   ·   ${profile.name}` : ''}
          {'   ·   Erstellt am '}
          {formatDate(new Date())}
        </Text>
        <View style={styles.divider} />

        {hasGeneral && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allgemein</Text>
            {profile?.symptoms_since && (
              <View style={styles.row}>
                <Text style={styles.label}>Beschwerden seit</Text>
                <Text style={styles.value}>{formatDate(new Date(profile.symptoms_since))}</Text>
              </View>
            )}
            {profile?.medications && (
              <View style={styles.row}>
                <Text style={styles.label}>Medikamente/Supplements</Text>
                <Text style={styles.value}>{profile.medications}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beschwerden (Durchschnitt 0–10)</Text>
          {data.symptomAverages.map((s) => (
            <View style={styles.row} key={s.label}>
              <Text style={styles.label}>{s.label}</Text>
              <Text style={styles.value}>{s.average}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stuhlgang</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Anzahl gesamt</Text>
            <Text style={styles.value}>{data.bowelCount}</Text>
          </View>
          <Text style={styles.subLabel}>Bristol-Verteilung (1–7)</Text>
          <View style={styles.table}>
            {data.bristolCounts.map((count, i) => (
              <View key={i} style={styles.tableCell}>
                <Text>{i + 1}</Text>
                <Text>{count}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.subLabel}>Auffälligkeiten</Text>
          {data.flagCounts.map((f) => (
            <View style={styles.row} key={f.label}>
              <Text style={styles.label}>{f.label}</Text>
              <Text style={styles.value}>{f.count}×</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ernährung</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Mahlzeiten erfasst</Text>
            <Text style={styles.value}>{data.mealCount}</Text>
          </View>
          {data.topFoods.length > 0 && (
            <>
              <Text style={styles.subLabel}>Häufigste Lebensmittel</Text>
              <Text style={styles.value}>{data.topFoods.map(([food, count]) => `${food} (${count}×)`).join(', ')}</Text>
            </>
          )}
          <Text style={styles.subLabel}>Anteil Mahlzeiten mit ...</Text>
          {data.markerShare.map((m) => (
            <View style={styles.row} key={m.label}>
              <Text style={styles.label}>{m.label}</Text>
              <Text style={styles.value}>{m.percent}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontext</Text>
          {data.placeDays.length > 0 ? (
            data.placeDays.map((p) => (
              <View style={styles.row} key={p.place}>
                <Text style={styles.label}>{p.place}</Text>
                <Text style={styles.value}>
                  {p.days} {p.days === 1 ? 'Tag' : 'Tage'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.label}>Keine Ortsangaben</Text>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Stress Ø (1–5)</Text>
            <Text style={styles.value}>{data.avgStress ?? '–'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Schlaf Ø (1–5)</Text>
            <Text style={styles.value}>{data.avgSleep ?? '–'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Trinken Ø pro Tag</Text>
            <Text style={styles.value}>{formatLiters(data.avgWaterMlPerDay)}</Text>
          </View>
        </View>

        {data.documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vorliegende Befunde</Text>
            {data.documents.map((d, i) => (
              <View key={i} style={{ marginBottom: 3 }}>
                <View style={styles.row}>
                  <Text style={styles.value}>{d.title}</Text>
                  <Text style={styles.label}>{d.docDate ? formatDate(new Date(d.docDate)) : ''}</Text>
                </View>
                {d.summary && <Text style={styles.label}>{d.summary}</Text>}
              </View>
            ))}
          </View>
        )}

        {data.notePatterns.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wiederkehrende Beobachtungen in den Notizen</Text>
            {data.notePatterns.map((p, i) => (
              <Text key={i} style={styles.value}>
                · {p}
              </Text>
            ))}
          </View>
        )}

        {data.savedQuestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fragen an den Arzt</Text>
            {data.savedQuestions.map((q, i) => (
              <Text key={i} style={styles.value}>
                · {q}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}
