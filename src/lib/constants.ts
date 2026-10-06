export const bristolLabels: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string> = {
  1: 'sehr hart',
  2: 'hart',
  3: 'fest',
  4: 'normal',
  5: 'weich',
  6: 'breiig',
  7: 'wässrig',
}

export const flagLabels = {
  pain: 'Schmerzen',
  incomplete: 'Unvollständig',
  mucus: 'Schleim',
  blood: 'Blut',
} as const

export const urgencyLabels = {
  0: 'nicht',
  1: 'leicht',
  2: 'stark',
} as const

export const symptomLabels = {
  abdominal_pain: 'Bauchschmerzen',
  bloating: 'Blähungen',
  nausea: 'Übelkeit',
  fullness: 'Völlegefühl',
  urgency: 'Stuhldrang',
  stress: 'Stress',
  rumbling: 'Rumpeln/Darmgeräusche',
  heartburn: 'Sodbrennen',
} as const

export const situationLabels = {
  home: 'Zu Hause',
  away: 'Unterwegs',
  work: 'Arbeit',
} as const

export const mealTypeLabels = {
  fruehstueck: 'Frühstück',
  mittag: 'Mittagessen',
  abend: 'Abendessen',
  snack: 'Snack',
} as const

export const markerLabels = {
  gluten: 'Gluten',
  laktose: 'Laktose',
  fodmap_hoch: 'FODMAP hoch',
  zuckeraustausch: 'Zuckeraustauschstoffe',
  viel_zucker: 'Viel Zucker',
  fettreich: 'Fettreich',
  scharf: 'Scharf',
  rotes_fleisch: 'Rotes Fleisch',
  verarbeitetes_fleisch: 'Verarbeitetes Fleisch',
  stark_verarbeitet: 'Stark verarbeitet',
  kaffee: 'Kaffee',
  alkohol: 'Alkohol',
  kohlensaeure: 'Kohlensäure',
} as const

export const goodMarkerLabels = {
  ballaststoffe: 'Ballaststoffe',
  gemuese: 'Gemüse',
  obst_fodmap_arm: 'FODMAP-armes Obst',
  fermentiert: 'Fermentiert',
  gesunde_fette: 'Gesunde Fette',
  ausreichend_getrunken: 'Ausreichend getrunken',
} as const

export const portionLabels = {
  klein: 'Klein',
  normal: 'Normal',
  gross: 'Groß',
} as const

export type PortionKey = keyof typeof portionLabels

export const phaseLabels = {
  alltag: 'Alltag',
  urlaub: 'Urlaub',
  krank: 'Krank',
} as const

export const phaseDescriptions = {
  alltag: 'Normale Wochen mit Arbeit. Wochenenden erkennt die App automatisch.',
  urlaub: 'Keine Arbeit, andere Tagesstruktur und Ernährung möglich.',
  krank: 'Erkältung, Infekt oder andere kurzfristige Erkrankung.',
} as const

export const stepStatusLabels = {
  done: 'erledigt',
  planned: 'geplant',
  open: 'offen',
} as const

export const labStatusLabels = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
} as const

export const findingStatusLabels = {
  unauffaellig: 'Unauffällig',
  auffaellig: 'Auffällig',
} as const

export const dayTagLabels = {
  viele_termine: 'Viele Termine',
  zeitdruck: 'Zeitdruck',
  streit_aerger: 'Streit/Ärger',
  viel_unterwegs: 'Viel unterwegs',
  schlecht_geschlafen: 'Schlecht geschlafen',
  ruhiger_tag: 'Ruhiger Tag',
} as const

export const themeModeLabels = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
} as const

const symptomPhrases: Record<keyof typeof symptomLabels, Record<'leicht' | 'mittel' | 'stark', string>> = {
  abdominal_pain: {
    leicht: 'leichte Bauchschmerzen',
    mittel: 'mittlere Bauchschmerzen',
    stark: 'starke Bauchschmerzen',
  },
  bloating: { leicht: 'leichte Blähungen', mittel: 'mittlere Blähungen', stark: 'starke Blähungen' },
  nausea: { leicht: 'leichte Übelkeit', mittel: 'mittlere Übelkeit', stark: 'starke Übelkeit' },
  fullness: {
    leicht: 'leichtes Völlegefühl',
    mittel: 'mittleres Völlegefühl',
    stark: 'starkes Völlegefühl',
  },
  urgency: { leicht: 'leichter Stuhldrang', mittel: 'mittlerer Stuhldrang', stark: 'starker Stuhldrang' },
  stress: { leicht: 'leichter Stress', mittel: 'mittlerer Stress', stark: 'starker Stress' },
  rumbling: { leicht: 'leichtes Rumpeln', mittel: 'mittleres Rumpeln', stark: 'starkes Rumpeln' },
  heartburn: { leicht: 'leichtes Sodbrennen', mittel: 'mittleres Sodbrennen', stark: 'starkes Sodbrennen' },
}

export function describeStrongestSymptom(
  values: Record<keyof typeof symptomLabels, number>,
  keys: (keyof typeof symptomLabels)[] = Object.keys(symptomLabels) as (keyof typeof symptomLabels)[],
): string {
  const entries = keys.map((key) => [key, values[key]] as const)
  const [key, value] = entries.reduce((max, entry) => (entry[1] > max[1] ? entry : max))
  if (value <= 0) return 'Keine Beschwerden'
  const severity = value <= 3 ? 'leicht' : value <= 6 ? 'mittel' : 'stark'
  return symptomPhrases[key][severity]
}
