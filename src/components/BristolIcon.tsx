type Props = {
  type: 1 | 2 | 3 | 4 | 5 | 6 | 7
  className?: string
}

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function BristolIcon({ type, className }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} {...common}>
      {type === 1 && (
        <>
          <circle cx="11" cy="12" r="3" />
          <circle cx="20" cy="11" r="3" />
          <circle cx="23" cy="19" r="3" />
          <circle cx="13" cy="21" r="3" />
        </>
      )}
      {type === 2 && (
        <>
          <rect x="5" y="12" width="22" height="8" rx="4" />
          <path d="M11 12v8" />
          <path d="M16 12v8" />
          <path d="M21 12v8" />
        </>
      )}
      {type === 3 && (
        <>
          <rect x="5" y="12" width="22" height="8" rx="4" />
          <path d="M13 13v2" />
          <path d="M19 17v2" />
        </>
      )}
      {type === 4 && <path d="M5 14c3-3 6-3 8 0s5 3 8 0 6-3 6 2-3 5-6 2-5-3-8 0-8 0-8-4Z" />}
      {type === 5 && (
        <>
          <ellipse cx="11" cy="16" rx="5" ry="4" />
          <ellipse cx="23" cy="16" rx="4.5" ry="3.5" />
        </>
      )}
      {type === 6 && (
        <path d="M6 18c1-4 3-5 5-3 1-3 4-3 5-1 1-3 4-4 6-1 2 2 3 5 1 6-2 2-5 1-7 0-2 1-5 2-7 0-2-1-4-1-3-1Z" />
      )}
      {type === 7 && (
        <>
          <path d="M5 12c2 2 4-2 6 0s4-2 6 0 4-2 6 0" />
          <path d="M5 17c2 2 4-2 6 0s4-2 6 0 4-2 6 0" />
          <path d="M5 22c2 2 4-2 6 0s4-2 6 0 4-2 6 0" />
        </>
      )}
    </svg>
  )
}
