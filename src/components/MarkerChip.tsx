import { Info } from 'lucide-react'

export function MarkerChip({
  label,
  tone,
  onInfo,
}: {
  label: string
  tone: 'primary' | 'warning'
  onInfo: () => void
}) {
  return (
    <button
      type="button"
      onClick={onInfo}
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
        tone === 'primary' ? 'bg-primary-light text-primary-text' : 'bg-warning-light text-warning'
      }`}
    >
      {label}
      <Info size={11} strokeWidth={2} />
    </button>
  )
}
