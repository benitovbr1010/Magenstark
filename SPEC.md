# Verdauungstagebuch – Spezifikation

Persönliche Web-App (PWA) zum Erfassen von Mahlzeiten, Stuhlgang, Befinden und Kontext, mit Wochenauswertung, Befund-Auswertung und Arztbericht als PDF.
Zunächst nur für einen Nutzer (mich). Später evtl. Veröffentlichung, daher sauber strukturieren.

Design-Vorlagen liegen in `/design` (Screenshots aus den Mockups). Sie sind die Referenz für Layout und Stil. Abweichungen und Korrekturen stehen unten unter „Korrekturen gegenüber Mockups“ und haben Vorrang.

---

## 1. Technik

- **Frontend:** Vite + React + TypeScript, Tailwind CSS
- **PWA:** installierbar über Safari „Zum Home-Bildschirm“ (Manifest, Icons, Standalone-Modus, Safe-Area beachten)
- **Backend / Daten:** Supabase (Region Frankfurt/EU)
  - Auth (nur E-Mail-Login für mich, später erweiterbar)
  - Postgres für alle Einträge, Row Level Security pro Nutzer
  - Storage für hochgeladene Befunde (PDF, Fotos)
  - Edge Functions für alle KI-Aufrufe (API-Key darf nie ins Frontend)
- **KI:** Claude API (Anthropic) über Edge Function
- **Spracheingabe:**
  - MVP: „Erzählen“-Button öffnet ein Textfeld mit Fokus, Eingabe per iOS-Tastatur-Diktat (Mikrofon auf der Tastatur). Kostenlos und gutes Deutsch.
  - Phase 2: echte Aufnahme per MediaRecorder + Transkription über einen Speech-to-Text-Dienst in einer Edge Function
- **PDF:** clientseitig (z. B. @react-pdf/renderer), Teilen über Web Share API bzw. Download
- **Hosting:** Vercel oder Netlify (kostenlos)
- **Sprache der UI:** Deutsch, Datumsformat deutsch, Woche beginnt Montag

Wichtig: Daten nicht nur im Browser speichern. iOS kann lokalen Speicher von Web-Apps löschen. Alles liegt in Supabase.

---

## 2. Design

Ruhig, natürlich, viel Weißraum, wenig Text. Kein Beige/Creme/Gelbstich, keine Emojis, keine Verläufe.

Farben (Richtwerte, aus den Mockups abgeleitet):
- Hintergrund: kühles Weiß `#F7F8F8`, Karten `#FFFFFF`, Rahmen `#E6E9E7`
- Primär Salbeigrün: `#6F8A74`, hell (Chips) `#E6EDE7`, Text auf hell `#3F5A45`
- Warnung Lehmrot: Text `#A8483E`, Chip-Hintergrund `#F4E1DE` (weniger rosa als im Mockup)
- Text: `#15181A`, sekundär `#5E6663`, tertiär `#9AA19E`

Typografie: moderne, freundliche Sans-Serif (z. B. Inter Tight oder System-Font). Titel groß, aber etwas leichter als im Mockup (semibold statt extra bold).

Icons: feine Linien-Icons (z. B. Lucide), einheitlich.

Dark Mode: optional in Phase 3.

---

## 3. Navigation

Tab-Leiste mit 3 Tabs (Icons wie im allerersten Mockup):
- **Heute** (Kalender-Icon)
- **Woche** (Balken-/Kalender-Icon)
- **Mein Weg** (Weg-Icon)

Erfassungs-Screens (Mahlzeit, Toilette, Befinden, Tagesabschluss, Dokument) öffnen als Vollbild ohne Tab-Leiste, mit Zurück-Pfeil.

---

## 4. Screens

### 4.1 Heute
- Titel „Heute“, Datum
- Kontext-Chip „Berlin · Alltag“ (antippbar → Kontext-Sheet)
  - Wenn der eingestellte Zeitraum abgelaufen ist: Chip wird zum Banner „Noch in Berlin?“ mit „Ja“ (verlängert, Enddatum offen) und „Ändern“
- Wochenleiste Mo–So, Tag antippbar (zeigt Einträge dieses Tages)
- Zeitleiste aller Einträge des Tages, chronologisch:
  - Mahlzeit: Uhrzeit, Typ (Frühstück/Mittag/Abend/Snack), Kurzbeschreibung, max. 3 Marker-Chips + „+n“
  - Toilette: Uhrzeit, „Typ 4 · normal“, ggf. kleine Flags
  - Befinden: Uhrzeit, Kurztext der stärksten Beschwerde
- Abends (ab 19 Uhr) oder wenn noch nicht erledigt: Karte am Ende „Tag abschließen“
- Einträge antippbar → bearbeiten/löschen
- Unten: großer runder Button „Erzählen“ (Mahlzeit), links „Toilette“, rechts „Befinden“

### 4.2 Mahlzeit erfassen („Erzählen“)
1. Textfeld (Diktat), Button „Auswerten“
2. KI liefert Zusammenfassung (siehe 6.1), Anzeige:
   - „Das hast du erzählt“ (Originaltext)
   - Karte „Zusammenfassung“: Mahlzeittyp, Kurzbeschreibung, Zeile „Mögliche Auslöser“ (lehmrot), Zeile „Gut“ (grün)
3. Uhrzeit antippbar (Standard: jetzt, von KI übernommen falls im Text genannt, z. B. „heute Mittag“)
4. „Eintrag speichern“, „Bearbeiten“ (Beschreibung und Marker manuell korrigierbar)

### 4.3 Toilettengang
- Datum + Uhrzeit (antippbar)
- Bristol-Skala 1–7 als Raster mit eigenen, dezenten Linien-Icons:
  1 sehr hart · 2 hart · 3 fest · 4 normal · 5 weich · 6 breiig · 7 wässrig
  (Typ 1 = kleine harte Kugeln, Typ 5 = weiche Klumpen mit klaren Rändern, müssen sich klar unterscheiden)
- Toggle-Chips: Schmerzen, Dringend, Unvollständig, Schleim, Blut
- Notiz (optional)
- „Eintrag speichern“

### 4.4 Befinden
- Datum + Uhrzeit
- Stimmung: 5 abstrakte Kreise, Beschriftung „schlecht“ … „gut“
- Regler 0–10 (Standard 0): Bauchschmerzen, Blähungen, Übelkeit, Völlegefühl, Stuhldrang
- Situation: Zu Hause / Unterwegs / Arbeit
- Toilette erreichbar: Ja / Nein
- Notiz
- „Eintrag speichern“

### 4.5 Kontext-Sheet („Wo bist du gerade?“)
- Ort: Chips (Dresden, Berlin, Ahlbeck, + Ort hinzufügen)
- Zeitraum: von / bis, Schalter „Kein Enddatum“
- Phase: Alltag / Urlaub / Krank, mit kurzer Erklärung unter der gewählten Phase
  - Alltag: „Normale Wochen mit Arbeit. Wochenenden erkennt die App automatisch.“
- **Kein** Schalter „Stressige Zeit“ (Stress kommt aus dem Tagesabschluss)
- „Übernehmen“
- Jeder neue Eintrag speichert Ort und Phase mit (Snapshot)

### 4.6 Tagesabschluss
- „Wie war dein Tag?“, Datum
- Stress heute: 5 Punkte, Endbeschriftung „wenig“ / „viel“
- Schlaf letzte Nacht: 5 Punkte, Endbeschriftung „schlecht“ / „gut“
- „Was trifft zu?“: Viele Termine, Zeitdruck, Streit/Ärger, Viel unterwegs, Schlecht geschlafen, Ruhiger Tag
- Notiz „Noch etwas?“
- „Tag abschließen“

### 4.7 Woche
- Zeitraum Mo–So mit Pfeilen
- Karten:
  - **Toilette:** Anzahl gesamt + Balken Bristol 1–7
  - **Befinden:** Linie Mo–So (Achse „gut“ oben / „schlecht“ unten), Stress-Tage markiert
  - **Mögliche Auslöser:** Balken mit Anzahl Mahlzeiten je Marker, darunter „Gut“-Marker grün
  - **Am häufigsten gegessen:** Top 4 Lebensmittel (aus KI-Feld `main_foods`)
  - **Nach Ort:** Tage mit Beschwerden je Ort
  - **Auffällig:** KI-Hinweise (siehe 6.3), erst ab ca. 21 Tagen Daten, sonst Hinweis „Noch zu wenig Daten für Muster“
  - **Idee für nächste Woche:** 1–3 Ernährungsideen (KI)
- Button „Arztbericht als PDF“ (Zeitraum wählbar: diese Woche, 2 Wochen, 4 Wochen)

### 4.8 Mein Weg
- Liste der Abklärungsschritte mit Status (erledigt / geplant + Datum / offen), Ergebnis-Kurztext
- „+ Schritt hinzufügen“, Schritte bearbeitbar, umsortierbar
- Dokumente: Kachel „+ Hochladen“ zuerst, dann Dokumente (Titel, Datum, Typ)
- Vorbefüllte Schritte werden gemeinsam festgelegt, nicht von der KI erfunden

### 4.9 Dokument
- Titel, Datum, Quelle (z. B. Hausarzt)
- Vorschau + „Öffnen“
- „Auswerten“-Button → Karte „Auswertung“ (siehe 6.2):
  - Ein Satz Gesamtbild
  - Auffällige Werte: Name, Wert, Referenzbereich, Status-Chip
  - Fester Hinweis: „Keine Diagnose. Bitte mit deinem Arzt besprechen.“
- „Fragen für deinen Arzt“: Vorschläge, leerer Kreis = nicht gemerkt, gefüllt = für Arztbericht gemerkt
- Chat-Feld „Frag etwas zu diesem Befund …“ (Verlauf pro Dokument speichern)

### 4.10 Arztbericht (PDF)
Eine Seite A4, nüchtern, schwarz-grau mit wenigen grünen Überschriften.
- Kopf: „Verlaufsbericht · Zeitraum“, Name, Erstellungsdatum
- **Allgemein** (aus Profil): Beschwerden seit, aktuelle Medikamente/Supplements
- **Beschwerden:** Durchschnitt 0–10 je Symptom
- **Stuhlgang:** Anzahl, Tabelle Bristol 1–7, Flags (Schmerzen, Dringend, Unvollständig, Schleim, Blut)
- **Ernährung:** häufigste Lebensmittel, Anteil Mahlzeiten mit Gluten, Laktose, FODMAP hoch
- **Kontext:** Tage je Ort, Stress Ø, Schlaf Ø
- **Vorliegende Befunde:** Titel, Datum, Kurzergebnis
- **Fragen an den Arzt:** nur die gemerkten Fragen
- **Nicht** enthalten: Empfehlungen, Supplements, KI-Interpretationen, „Auffällig“-Hinweise

---

## 5. Datenmodell (Supabase)

```
profiles        id, name, symptoms_since, medications (text), created_at
contexts        id, user_id, place, phase ('alltag'|'urlaub'|'krank'), start_date, end_date (null = offen)
meals           id, user_id, eaten_at, meal_type, raw_text, summary, main_foods (text[]),
                markers (text[]), good_markers (text[]), place, phase, created_at
bowel_movements id, user_id, occurred_at, bristol (1–7), pain, urgent, incomplete, mucus, blood (bool),
                note, place, phase
wellbeing       id, user_id, occurred_at, mood (1–5), abdominal_pain, bloating, nausea, fullness,
                urgency (0–10), situation ('home'|'away'|'work'), toilet_reachable (bool), note, place, phase
day_closings    id, user_id, date (unique pro user), stress (1–5), sleep (1–5), tags (text[]), note
steps           id, user_id, title, status ('done'|'planned'|'open'), date, result_short, sort_order
documents       id, user_id, title, doc_date, source, file_path, analysis (jsonb), created_at
doctor_questions id, user_id, document_id (nullable), text, saved (bool), created_at
document_chats  id, document_id, role, content, created_at
```

---

## 6. KI-Funktionen (Edge Functions, Claude API)

Alle Antworten als JSON, im Code validiert. Ton: sachlich, deutsch, kurz.

### 6.1 Mahlzeit auswerten
Input: Freitext, aktuelle Uhrzeit.
Output:
```json
{
  "meal_type": "mittag",
  "eaten_at_hint": "12:45 oder null",
  "summary": "Spaghetti Bolognese, gemischter Salat, Joghurtdressing",
  "main_foods": ["Nudeln", "Hackfleisch", "Salat", "Joghurt"],
  "markers": ["gluten", "laktose", "fodmap_hoch", "rotes_fleisch"],
  "good_markers": ["gemuese"],
  "fodmap_sources": ["Zwiebel", "Knoblauch", "Weizen"]
}
```
Marker-Liste (fest im Code, erweiterbar):
- Mögliche Auslöser: `gluten`, `laktose`, `fodmap_hoch`, `zuckeraustausch`, `viel_zucker`, `fettreich`, `scharf`, `rotes_fleisch`, `verarbeitetes_fleisch`, `stark_verarbeitet`, `kaffee`, `alkohol`, `kohlensaeure`
- Gut: `ballaststoffe`, `gemuese`, `obst_fodmap_arm`, `fermentiert`, `gesunde_fette`, `ausreichend_getrunken`
Die KI soll typische Zutaten realistisch annehmen (Bolognese enthält meist Zwiebel/Knoblauch) und bei Unsicherheit lieber weglassen.
`fettreich` wird nicht frei von der KI vergeben, sondern aus festen Regeln berechnet: Zubereitung (frittiert/paniert/viel Öl) ODER eine fettreiche Zutat (Käse, Butter, Sahne, Wurst, Speck, Öle – auch die unten genannten „gesunden Fette") in großer Menge. Dafür schätzt die KI pro Zutat Menge (wenig/normal/viel) und Zubereitungsart, der Code entscheidet nach festen Regeln.
`gesunde_fette` wird nur für eine feste Zutatenliste vergeben (Olivenöl/Raps-/Leinöl, Nüsse, Samen, Avocado, fetter Fisch) – Käse, Butter, Sahne, Wurst, Speck sind NIE `gesunde_fette`, unabhängig von der Menge.

### 6.2 Befund auswerten
Input: PDF/Foto des Befunds.
Output: Gesamtsatz, Liste auffälliger Werte (Name, Wert, Einheit, Referenzbereich, Status), 1–3 Fragen für den Arzt.
Regeln: erklären, nie diagnostizieren; Fragen offen formulieren; Zusammenhänge zu Symptomen nur als Frage.

### 6.3 Wochen-Hinweise
Input: aggregierte Daten (nicht Rohtexte) der letzten 3–6 Wochen.
Output: max. 3 „Auffällig“-Hinweise mit vorsichtiger Formulierung („könnte zusammenhängen“), max. 3 Ideen für nächste Woche.
Nur ausführen, wenn mindestens 21 Tage Daten vorhanden sind.

---

## 7. Korrekturen gegenüber Mockups

1. Warn-Chips lehmrot statt rosa
2. Titel etwas leichter (weniger fett)
3. Befinden-Icon: Herzschlag oder Welle statt Personen-Icon
4. Tab-Leiste einheitlich wie im ersten Mockup (Kalender, Kalender-Raster, Weg)
5. Keine Tab-Leiste auf Erfassungs-Screens
6. Bristol-Icons 1 und 5 klar unterscheidbar
7. Kein „Stressige Zeit“-Schalter im Kontext-Sheet
8. Stress/Schlaf mit Endbeschriftungen
9. Befinden-Linie mit Achsenbeschriftung
10. „Auffällig“ erst ab ca. 21 Tagen Daten
11. Referenzbereich neben Laborwerten
12. Fragen-Kreise im Normalzustand leer
13. Upload-Kachel als erste Kachel
14. Arztbericht zusätzlich mit „Allgemein“ (Beschwerden seit, Medikamente)

---

## 8. Bau-Reihenfolge

**Phase 1 – Grundgerüst (erst nutzbar machen)**
1. Projekt aufsetzen, Supabase anbinden, Login, PWA-Manifest
2. Design-Tokens + Tab-Navigation
3. Toilettengang und Befinden (ohne KI, schnell nutzbar)
4. Heute-Screen mit Zeitleiste
5. Mahlzeit mit Textfeld + KI-Auswertung (6.1)
6. Kontext-Sheet und Tagesabschluss

→ Ab hier täglich benutzen und Daten sammeln.

**Phase 2 – Auswertung**
7. Wochenübersicht (ohne „Auffällig“)
8. Arztbericht-PDF
9. Mein Weg + Dokument-Upload
10. Befund-Auswertung + Chat (6.2)

**Phase 3 – Feinschliff**
11. Wochen-Hinweise (6.3), sobald genug Daten da sind
12. Echte Sprachaufnahme mit Transkription
13. Dark Mode, Export aller Daten (CSV/JSON)

**Vor einer Veröffentlichung:** Datenschutz (Gesundheitsdaten nach Art. 9 DSGVO), Einwilligungen, AV-Verträge mit Supabase und KI-Anbieter, klare Hinweise „kein Medizinprodukt“.
