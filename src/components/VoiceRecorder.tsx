import { Mic, Square } from 'lucide-react'
import { useRef, useState } from 'react'
import { transcribeAudio } from '../lib/transcribe'

type Status = 'idle' | 'recording' | 'transcribing'

function pickMimeType(): string {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function VoiceRecorder({ onTranscribed }: { onTranscribed: (text: string) => void }) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setStatus('transcribing')
        const text = await transcribeAudio(blob)
        setStatus('idle')
        if (text) {
          onTranscribed(text)
        } else {
          setError('Transkription fehlgeschlagen. Bitte erneut versuchen.')
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setStatus('recording')
    } catch {
      setError('Mikrofonzugriff nicht möglich.')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={status === 'transcribing'}
        aria-label={status === 'recording' ? 'Aufnahme stoppen' : 'Sprachaufnahme starten'}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
          status === 'recording' ? 'bg-warning text-white' : 'bg-primary-light text-primary-text'
        }`}
      >
        {status === 'recording' ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
      </button>
      {status === 'recording' && <span className="text-xs text-warning">Aufnahme läuft …</span>}
      {status === 'transcribing' && <span className="text-xs text-text-tertiary">Wird transkribiert …</span>}
      {error && <span className="text-xs text-warning">{error}</span>}
    </div>
  )
}
