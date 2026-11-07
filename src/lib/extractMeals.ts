import { supabase } from './supabaseClient'

export type MealSegment = {
  meal_type: 'fruehstueck' | 'mittag' | 'abend' | 'snack'
  time_hint: string | null
  text: string
}

export type MealImageInput = { data: string; mediaType: string }

/** Liest eine Bilddatei als reines Base64 (ohne data:-Präfix) + Media-Type. */
export function fileToBase64Image(file: File): Promise<MealImageInput> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, data] = result.split(',')
      resolve({ data, mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function extractMealSegments(input: {
  text?: string
  images?: MealImageInput[]
}): Promise<MealSegment[] | null> {
  const { data, error } = await supabase.functions.invoke('extract-meals', {
    body: { ...input, currentTime: new Date().toISOString() },
  })
  if (error || !data?.segments) return null
  return data.segments as MealSegment[]
}
