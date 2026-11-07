import { Camera, Mic, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mealTypeLabels } from '../lib/constants'
import { DateTimeField } from './DateTimeField'
import { ToggleChip } from './ToggleChip'

type MealType = keyof typeof mealTypeLabels
const mealTypeKeys = Object.keys(mealTypeLabels) as MealType[]

export function AddMealSheet({
  open,
  onClose,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  initialDate: Date
}) {
  const navigate = useNavigate()
  const [mealType, setMealType] = useState<MealType>('fruehstueck')
  const [time, setTime] = useState(initialDate)

  // initialDate ändert sich beim Tag-Wechsel (WeekStrip), aber das Sheet bleibt dauerhaft gemountet
  // (nur `open` togglet) — Zeit daher bei jedem Öffnen neu aus initialDate übernehmen.
  useEffect(() => {
    if (open) setTime(initialDate)
  }, [open, initialDate])

  if (!open) return null

  function go(mode?: 'foto') {
    const params = new URLSearchParams({ type: mealType, time: time.toISOString() })
    if (mode) params.set('mode', mode)
    onClose()
    navigate(`/mahlzeit?${params.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-text">Mahlzeit nachtragen</h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {mealTypeKeys.map((key) => (
            <ToggleChip key={key} label={mealTypeLabels[key]} active={mealType === key} onClick={() => setMealType(key)} />
          ))}
        </div>

        <div className="mt-4">
          <DateTimeField value={time} onChange={setTime} />
        </div>

        <div className="mt-5 flex justify-center gap-6">
          <button type="button" onClick={() => go()} className="flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary-text">
              <Mic size={20} />
            </span>
            <span className="text-xs font-medium text-text-secondary">Audio</span>
          </button>
          <button type="button" onClick={() => go()} className="flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary-text">
              <Pencil size={20} />
            </span>
            <span className="text-xs font-medium text-text-secondary">Text</span>
          </button>
          <button type="button" onClick={() => go('foto')} className="flex flex-col items-center gap-1.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary-text">
              <Camera size={20} />
            </span>
            <span className="text-xs font-medium text-text-secondary">Foto</span>
          </button>
        </div>
      </div>
    </div>
  )
}
