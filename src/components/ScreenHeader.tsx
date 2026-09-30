import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function ScreenHeader({
  title,
  subtitle,
  subtitleSlot,
}: {
  title: string
  subtitle?: string
  subtitleSlot?: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className="flex items-start gap-3 px-4 pt-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Zurück"
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-secondary"
      >
        <ChevronLeft size={22} strokeWidth={1.75} />
      </button>
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitleSlot ? (
          <div className="mt-1">{subtitleSlot}</div>
        ) : (
          subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
