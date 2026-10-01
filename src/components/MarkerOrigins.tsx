import { fodmapTypeLabels } from '../lib/ingredientProfiles'

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

/** Zeigt pro Marker die verantwortlichen Zutaten an, z. B. "FODMAP hoch: Zwiebel, Knoblauch".
 * Bei FODMAP zusätzlich die Art (Fruktane/Laktose/...) klein und grau. */
export function MarkerOrigins({
  origins,
  labels,
  fodmapTypesByIngredient,
  tone,
}: {
  origins: Record<string, string[]>
  labels: Record<string, string>
  fodmapTypesByIngredient?: Record<string, string[]>
  tone: 'warning' | 'primary'
}) {
  const keys = Object.keys(origins).filter((k) => labels[k])
  if (keys.length === 0) return null

  return (
    <div className="mt-2 flex flex-col gap-1">
      {keys.map((key) => {
        const names = origins[key]
        const fodmapTypes =
          key === 'fodmap_hoch' && fodmapTypesByIngredient
            ? Array.from(new Set(names.flatMap((n) => fodmapTypesByIngredient[n] ?? [])))
            : []
        return (
          <p key={key} className={`text-xs ${tone === 'warning' ? 'text-warning' : 'text-primary-text'}`}>
            <span className="font-medium">{labels[key]}:</span> {names.map(capitalize).join(', ')}
            {fodmapTypes.length > 0 && (
              <span className="ml-1 text-text-tertiary">({fodmapTypes.map((t) => fodmapTypeLabels[t as keyof typeof fodmapTypeLabels] ?? t).join(', ')})</span>
            )}
          </p>
        )
      })}
    </div>
  )
}
