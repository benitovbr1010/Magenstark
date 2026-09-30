export function ToggleChip({
  label,
  active,
  onClick,
  tone = 'primary',
}: {
  label: string
  active: boolean
  onClick: () => void
  tone?: 'primary' | 'warning'
}) {
  const activeClass =
    tone === 'warning'
      ? 'border-warning-light bg-warning-light text-warning'
      : 'border-primary-light bg-primary-light text-primary-text'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active ? activeClass : 'border-border bg-card text-text-secondary'
      }`}
    >
      {label}
    </button>
  )
}
