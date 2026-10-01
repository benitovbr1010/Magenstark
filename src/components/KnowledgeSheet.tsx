import { X } from 'lucide-react'
import type { KnowledgeArticle } from '../lib/knowledge'

export function KnowledgeSheet({
  article,
  onClose,
}: {
  article: KnowledgeArticle | null
  onClose: () => void
}) {
  if (!article) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-text">{article.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="shrink-0 rounded-full p-1 text-text-secondary"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {article.body.map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-text-secondary">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
