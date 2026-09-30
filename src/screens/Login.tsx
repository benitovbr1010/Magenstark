import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({ email })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-text">Anmelden</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Gib deine E-Mail-Adresse ein, du bekommst einen Anmelde-Link.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="du@beispiel.de"
          className="rounded-xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {status === 'sending' ? 'Wird gesendet …' : 'Link senden'}
        </button>
      </form>

      {status === 'sent' && (
        <p className="mt-4 rounded-xl bg-primary-light px-4 py-3 text-sm text-primary-text">
          Link gesendet. Bitte E-Mails prüfen.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-4 rounded-xl bg-warning-light px-4 py-3 text-sm text-warning">
          Da ist etwas schiefgelaufen. Bitte erneut versuchen.
        </p>
      )}
    </div>
  )
}
