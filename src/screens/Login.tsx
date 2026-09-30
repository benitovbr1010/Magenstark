import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL

export function Login() {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const { error } = await supabase.auth.signInWithPassword({ email: AUTH_EMAIL, password })
    if (error) {
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-text">Anmelden</h1>
      <p className="mt-1 text-sm text-text-secondary">Gib dein Passwort ein.</p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort"
          className="rounded-xl border border-border bg-card px-4 py-3 text-text outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-full bg-primary px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {status === 'sending' ? 'Wird geprüft …' : 'Anmelden'}
        </button>
      </form>

      {status === 'error' && (
        <p className="mt-4 rounded-xl bg-warning-light px-4 py-3 text-sm text-warning">
          Falsches Passwort. Bitte erneut versuchen.
        </p>
      )}
    </div>
  )
}
