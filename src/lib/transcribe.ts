import { supabase } from './supabaseClient'

export async function transcribeAudio(blob: Blob): Promise<string | null> {
  const form = new FormData()
  const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', blob, `aufnahme.${extension}`)

  const { data, error } = await supabase.functions.invoke('transcribe-audio', { body: form })
  if (error || !data?.text) return null
  return data.text as string
}
