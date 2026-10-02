import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { NutritionExportData } from './nutritionExport'
import { formatLiters } from './water'

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 44, fontSize: 10, color: '#15181A', fontFamily: 'Helvetica' },
  headTitle: { fontSize: 16, color: '#3F5A45', marginBottom: 2 },
  headMeta: { fontSize: 9, color: '#5E6663', marginBottom: 10 },
  divider: { borderBottom: '1pt solid #E6E9E7', marginVertical: 8 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, color: '#3F5A45', marginBottom: 4, fontWeight: 'bold' },
  dayBlock: { marginBottom: 10, breakInside: 'avoid' },
  dayTitle: { fontSize: 11, color: '#15181A', marginBottom: 2, fontWeight: 'bold' },
  dayMeta: { fontSize: 8, color: '#5E6663', marginBottom: 3 },
  mealRow: { marginBottom: 2 },
  mealLine: { color: '#15181A' },
  markerLine: { fontSize: 8, color: '#5E6663' },
  infoLine: { color: '#15181A', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: '#5E6663' },
  subLabel: { color: '#5E6663', marginTop: 4, marginBottom: 2 },
  value: { color: '#15181A' },
  table: { flexDirection: 'row', marginTop: 2 },
  tableCell: { flex: 1, textAlign: 'center', borderTop: '1pt solid #E6E9E7', paddingTop: 2 },
  pageNumber: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#5E6663' },
})

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function NutritionDiaryDocument({ data }: { data: NutritionExportData }) {
  const { stats } = data

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.headTitle}>
          Ernährungstagebuch · {formatDate(data.from)} – {formatDate(data.to)}
        </Text>
        <Text style={styles.headMeta}>
          {data.name ? `${data.name}   ·   ` : ''}Erstellt am {formatDate(new Date())}
        </Text>
        <View style={styles.divider} />

        {data.days.map((day) => (
          <View key={day.date} style={styles.dayBlock} wrap={false}>
            <Text style={styles.dayTitle}>{day.dateLabel}</Text>
            {(day.place || day.phase) && (
              <Text style={styles.dayMeta}>
                {[day.place, day.phase].filter(Boolean).join(' · ')}
              </Text>
            )}

            {!day.hasAnyEntry ? (
              <Text style={styles.label}>Keine Einträge</Text>
            ) : (
              <>
                {day.meals.map((m, i) => (
                  <View key={i} style={styles.mealRow}>
                    <Text style={styles.mealLine}>
                      {m.time} Uhr · {m.mealType}: {m.summary}
                      {m.ingredients.length > 0 ? ` (${m.ingredients.join(', ')})` : ''}
                    </Text>
                    {(m.markers.length > 0 || m.goodMarkers.length > 0) && (
                      <Text style={styles.markerLine}>
                        {m.markers.length > 0 ? `Mögliche Auslöser: ${m.markers.join(', ')}` : ''}
                        {m.markers.length > 0 && m.goodMarkers.length > 0 ? '   ·   ' : ''}
                        {m.goodMarkers.length > 0 ? `Gut: ${m.goodMarkers.join(', ')}` : ''}
                      </Text>
                    )}
                  </View>
                ))}

                {day.waterCount > 0 && (
                  <Text style={styles.infoLine}>
                    Wasser: {day.waterCount} {day.waterCount === 1 ? 'Glas' : 'Gläser'} ({formatLiters(day.waterMl)})
                  </Text>
                )}

                {day.bowelMovements.length > 0 && (
                  <Text style={styles.infoLine}>
                    Toilette: {day.bowelMovements.map((b) => `${b.time} Uhr (Typ ${b.bristol})`).join(', ')}
                  </Text>
                )}

                {day.symptomPeaks.length > 0 && (
                  <Text style={styles.infoLine}>
                    Beschwerden: {day.symptomPeaks.map((s) => `${s.label} ${s.value}`).join(', ')}
                  </Text>
                )}

                {(day.stress !== null || day.sleep !== null) && (
                  <Text style={styles.infoLine}>
                    {day.stress !== null ? `Stress ${day.stress}/5` : ''}
                    {day.stress !== null && day.sleep !== null ? '   ·   ' : ''}
                    {day.sleep !== null ? `Schlaf ${day.sleep}/5` : ''}
                  </Text>
                )}
              </>
            )}
          </View>
        ))}

        <View style={styles.divider} />
        <Text style={styles.headTitle}>Auswertung</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ernährung</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Mahlzeiten gesamt</Text>
            <Text style={styles.value}>{stats.mealCount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Mahlzeiten Ø pro Tag</Text>
            <Text style={styles.value}>{stats.mealsPerDay}</Text>
          </View>
          {stats.topIngredients.length > 0 && (
            <>
              <Text style={styles.subLabel}>Häufigste Lebensmittel/Zutaten</Text>
              <Text style={styles.value}>
                {stats.topIngredients.map(([food, count]) => `${food} ${count}×`).join(', ')}
              </Text>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marker</Text>
          <Text style={styles.subLabel}>Mögliche Auslöser</Text>
          {stats.markerCounts.length > 0 ? (
            stats.markerCounts.map((m) => (
              <View style={styles.row} key={m.label}>
                <Text style={styles.label}>{m.label}</Text>
                <Text style={styles.value}>
                  {m.count} von {stats.totalMealsForMarkerShare} Mahlzeiten
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.label}>Keine erfasst</Text>
          )}
          <Text style={styles.subLabel}>Gut</Text>
          {stats.goodMarkerCounts.length > 0 ? (
            stats.goodMarkerCounts.map((m) => (
              <View style={styles.row} key={m.label}>
                <Text style={styles.label}>{m.label}</Text>
                <Text style={styles.value}>
                  {m.count} von {stats.totalMealsForMarkerShare} Mahlzeiten
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.label}>Keine erfasst</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trinken</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Ø pro Tag</Text>
            <Text style={styles.value}>{formatLiters(stats.avgWaterMlPerDay)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Essensrhythmus</Text>
          {stats.mealRhythm.byMealType
            .filter((m) => m.count > 0)
            .map((m) => (
              <View style={styles.row} key={m.label}>
                <Text style={styles.label}>{m.label}</Text>
                <Text style={styles.value}>
                  {m.earliest}–{m.latest} Uhr{m.regularity ? ` (${m.regularity})` : ''}
                  {m.skippedDays > 0 ? `, ${m.skippedDays}× ausgelassen` : ''}
                </Text>
              </View>
            ))}
          {stats.mealRhythm.longestGapHours !== null && (
            <View style={styles.row}>
              <Text style={styles.label}>Längste Pause zwischen Mahlzeiten</Text>
              <Text style={styles.value}>{stats.mealRhythm.longestGapHours} Std.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stuhlgang</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Anzahl gesamt</Text>
            <Text style={styles.value}>{stats.bowelCount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ø pro Tag</Text>
            <Text style={styles.value}>{stats.bowelPerDay}</Text>
          </View>
          <Text style={styles.subLabel}>Bristol-Verteilung (1–7)</Text>
          <View style={styles.table}>
            {stats.bristolCounts.map((count, i) => (
              <View key={i} style={styles.tableCell}>
                <Text>{i + 1}</Text>
                <Text>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beschwerden (Durchschnitt 0–10)</Text>
          {stats.symptomAverages.map((s) => (
            <View style={styles.row} key={s.label}>
              <Text style={styles.label}>{s.label}</Text>
              <Text style={styles.value}>{s.average}</Text>
            </View>
          ))}
        </View>

        {stats.sleep.avgDurationHours !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schlaf</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Dauer Ø</Text>
              <Text style={styles.value}>{stats.sleep.avgDurationHours} Std.</Text>
            </View>
          </View>
        )}

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  )
}
