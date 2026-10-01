import { useState } from 'react'
import { ScreenHeader } from '../components/ScreenHeader'
import { KnowledgeSheet } from '../components/KnowledgeSheet'
import { goodMarkerLabels, markerLabels } from '../lib/constants'
import {
  goodMarkerArticle,
  knowledgeArticles,
  markerArticle,
  type KnowledgeArticle,
} from '../lib/knowledge'

const markerKeys = Object.keys(markerLabels) as (keyof typeof markerLabels)[]
const goodMarkerKeys = Object.keys(goodMarkerLabels) as (keyof typeof goodMarkerLabels)[]

export function Knowledge() {
  const [article, setArticle] = useState<KnowledgeArticle | null>(null)

  return (
    <div className="pb-10">
      <ScreenHeader title="Wissen" subtitle="Hintergrundwissen zur Verdauung" />

      <div className="mt-5 flex flex-col gap-2 px-4">
        {knowledgeArticles.map((a) => (
          <button
            key={a.slug}
            type="button"
            onClick={() => setArticle(a)}
            className="rounded-2xl border border-border bg-card p-4 text-left"
          >
            <p className="text-sm font-medium text-text">{a.title}</p>
          </button>
        ))}
      </div>

      <h2 className="mt-8 px-4 text-lg font-semibold text-text">Mögliche Auslöser</h2>
      <div className="mt-3 flex flex-col gap-2 px-4">
        {markerKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setArticle(markerArticle(key, markerLabels[key]))}
            className="rounded-2xl border border-warning/40 bg-warning-light p-4 text-left"
          >
            <p className="text-sm font-medium text-text">{markerLabels[key]}</p>
          </button>
        ))}
      </div>

      <h2 className="mt-8 px-4 text-lg font-semibold text-text">Gut für dich</h2>
      <div className="mt-3 flex flex-col gap-2 px-4">
        {goodMarkerKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setArticle(goodMarkerArticle(key, goodMarkerLabels[key]))}
            className="rounded-2xl border border-primary/40 bg-primary-light p-4 text-left"
          >
            <p className="text-sm font-medium text-text">{goodMarkerLabels[key]}</p>
          </button>
        ))}
      </div>

      <KnowledgeSheet article={article} onClose={() => setArticle(null)} />
    </div>
  )
}
