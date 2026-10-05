import type { goodMarkerLabels, markerLabels } from './constants'

export type KnowledgeArticle = {
  slug: string
  title: string
  body: string[]
}

/** Allgemeine Artikel, in dieser Reihenfolge auf der Wissen-Seite gezeigt. */
export const knowledgeArticles: KnowledgeArticle[] = [
  {
    slug: 'fodmap',
    title: 'Was sind FODMAPs?',
    body: [
      'FODMAP steht für fermentierbare Oligo-, Di- und Monosaccharide sowie Polyole – kurz: bestimmte schwer verdauliche Kohlenhydrate.',
      'Sie werden im Dünndarm schlecht aufgenommen, gelangen in den Dickdarm und werden dort von Bakterien vergoren. Dabei entstehen Gase und Wasser wird in den Darm gezogen – das kann Blähungen, Völlegefühl, Bauchschmerzen und Durchfall begünstigen.',
      'Typische Quellen: Zwiebeln, Knoblauch, Weizen, Milchprodukte (Laktose), Hülsenfrüchte, manche Obstsorten (z. B. Äpfel, Birnen) und Zuckeraustauschstoffe wie Sorbit oder Xylit.',
      'Wichtig: Eine Low-FODMAP-Ernährung ist nur als zeitlich begrenzte Testphase gedacht und sollte am besten mit einer Ernährungsberatung begleitet werden, damit die Ernährung danach wieder möglichst vielseitig ist.',
    ],
  },
  {
    slug: 'bristol',
    title: 'Die Bristol-Stuhlformen-Skala',
    body: [
      'Die Bristol-Skala beschreibt sieben Stuhlformen von sehr hart bis sehr flüssig.',
      'Typ 1–2 (einzelne harte Kugeln bzw. klumpige, wurstartige Form) deuten auf Verstopfung hin.',
      'Typ 3–4 gelten als normal: Typ 4 ist eine glatte, weiche Wurst – die ideale Form.',
      'Typ 5–7 (weiche Klumpen bis wässrig, ohne feste Stücke) deuten auf Durchfall bzw. eine zu schnelle Darmpassage hin.',
      'Einzelne Ausreißer sind normal. Wiederkehrende Muster lohnt es sich im Verlauf zu beobachten.',
    ],
  },
  {
    slug: 'oefter-essen',
    title: 'Öfter essen: gut verträgliche Lebensmittel',
    body: [
      'Haferflocken: enthalten gut verträgliche, lösliche Ballaststoffe (Beta-Glucan) und werden meist gut vertragen.',
      'Flohsamenschalen: binden Wasser und können die Verdauung regulieren – langsam steigern und dabei viel trinken, sonst wirken sie gegenteilig.',
      'Reis und Kartoffeln: FODMAP-arme, gut verdauliche Stärkequellen.',
      'Karotten und Zucchini: FODMAP-arme Gemüsesorten, die meist gut vertragen werden.',
      'Kiwi: unterstützt bei vielen Menschen die Verdauung und ist FODMAP-arm.',
      'Bananen: gut verträglich, wenn sie noch nicht überreif sind – je reifer, desto mehr vergärbare Kohlenhydrate.',
    ],
  },
  {
    slug: 'fett-und-verdauung',
    title: 'Fett und Verdauung',
    body: [
      'Nicht alle Fette sind gleich: Ungesättigte Fette aus Olivenöl, Raps- und Leinöl, Nüssen, Samen, Avocado und fettem Fisch (z. B. Lachs, Makrele) gelten als "gesunde Fette" und werden meist gut vertragen.',
      'Gesättigte, stark verarbeitete Fettquellen wie Käse, Butter, Sahne, Wurst oder Speck sind dagegen eher Belastung als Nutzen für die Verdauung – unabhängig von der Menge NIE als "gesunde Fette" markiert.',
      'Bei jeder Fettquelle gilt aber: Die Menge macht den Unterschied. Auch gesunde Fette können bei sehr großer Menge in einer Mahlzeit – genau wie Frittiertes, Paniertes oder in viel Öl Gebratenes – die Magenentleerung verlangsamen und Völlegefühl, Übelkeit oder Durchfall begünstigen.',
      'Deshalb wird "Fettreich" als möglicher Auslöser markiert, wenn eine Mahlzeit frittiert/paniert zubereitet wurde oder eine fettreiche Zutat in großer Menge enthält – unabhängig davon, ob die Zutat sonst als gesundes Fett gilt.',
    ],
  },
  {
    slug: 'arztbesuch',
    title: 'Wann zeitnah zum Arzt?',
    body: [
      'Bei Blut im Stuhl.',
      'Bei ungewolltem Gewichtsverlust.',
      'Bei Beschwerden, die dich nachts aufwecken oder aus dem Schlaf reißen.',
      'Bei Fieber zusammen mit Verdauungsbeschwerden.',
      'Diese Anzeichen sollten zeitnah ärztlich abgeklärt werden – diese App ersetzt keine ärztliche Diagnose.',
    ],
  },
]

export const markerExplanations: Record<keyof typeof markerLabels, string> = {
  gluten: 'Klebereiweiß in Weizen, Roggen, Gerste und Dinkel. Kann bei Unverträglichkeit oder Zöliakie Beschwerden auslösen.',
  laktose: 'Milchzucker in Milch und vielen Milchprodukten. Bei Laktoseintoleranz fehlt das Enzym, um ihn vollständig zu verdauen.',
  fodmap_hoch: 'Schwer verdauliche, vergärbare Kohlenhydrate (siehe Artikel „Was sind FODMAPs?“). Können Blähungen und Bauchschmerzen begünstigen.',
  zuckeraustausch: 'Zuckeraustauschstoffe wie Sorbit oder Xylit werden im Darm kaum aufgenommen und wirken ab einer gewissen Menge abführend.',
  viel_zucker: 'Große Mengen Zucker auf einmal können die Verdauung belasten und bei empfindlichem Darm Beschwerden auslösen.',
  fettreich: 'Große Fettmengen – egal ob durch Frittieren/Panieren oder reichlich Käse, Butter, Sahne, Wurst oder Speck – verlangsamen die Magenentleerung und können Völlegefühl, Übelkeit oder Durchfall begünstigen. Entscheidend ist die Menge, nicht nur die Zutat.',
  scharf: 'Scharfe Gewürze wie Chili können die Darmschleimhaut reizen und bei empfindlichem Darm Beschwerden auslösen.',
  rotes_fleisch: 'Rotes Fleisch ist fett- und proteinreich und kann bei manchen Menschen die Verdauung verlangsamen.',
  verarbeitetes_fleisch: 'Wurst und verarbeitetes Fleisch enthalten oft viel Fett, Salz und Zusatzstoffe, die den Darm reizen können.',
  stark_verarbeitet: 'Stark verarbeitete Lebensmittel enthalten oft viele Zusatzstoffe und wenig Ballaststoffe, was manchen Menschen schlecht bekommt.',
  kaffee: 'Koffein regt die Darmbewegung an und kann bei empfindlichem Darm zu Durchfall oder Krämpfen führen.',
  alkohol: 'Alkohol reizt die Darmschleimhaut und kann die Verdauung sowie die Darmbewegung durcheinanderbringen.',
  kohlensaeure: 'Kohlensäure kann zu vermehrter Gasbildung im Magen-Darm-Trakt führen und Blähungen begünstigen.',
}

export function markerArticle(key: keyof typeof markerLabels, label: string): KnowledgeArticle {
  return { slug: `marker-${key}`, title: label, body: [markerExplanations[key]] }
}

export function goodMarkerArticle(key: keyof typeof goodMarkerLabels, label: string): KnowledgeArticle {
  return { slug: `good-${key}`, title: label, body: [goodMarkerExplanations[key]] }
}

export const goodMarkerExplanations: Record<keyof typeof goodMarkerLabels, string> = {
  ballaststoffe: 'Ballaststoffe (z. B. aus Haferflocken, Flohsamenschalen) fördern eine regelmäßige Verdauung – am besten langsam steigern und viel trinken.',
  gemuese: 'Gemüse liefert Ballaststoffe, Vitamine und Wasser. FODMAP-arme Sorten wie Karotte oder Zucchini werden meist gut vertragen.',
  obst_fodmap_arm: 'FODMAP-armes Obst wie Kiwi, Banane (nicht überreif) oder Orange liefert Vitamine und wird meist gut vertragen.',
  fermentiert: 'Fermentierte Lebensmittel wie Joghurt oder Sauerkraut enthalten Milchsäurebakterien, die manchen Menschen guttun.',
  gesunde_fette: 'Ungesättigte Fette, z. B. aus Olivenöl oder Nüssen, sind magenschonender als stark frittierte oder fettreiche Speisen.',
  ausreichend_getrunken: 'Ausreichend Flüssigkeit unterstützt eine normale Stuhlkonsistenz und ist besonders bei viel Ballaststoffen wichtig.',
}
