// Edge Function: Audio-Transkription per Groq Whisper (SPEC.md §2 "Spracheingabe", Schritt 12)
// Bekommt eine Audioaufnahme als multipart/form-data (Feld "audio"), reicht sie an die
// Groq-API (OpenAI-kompatibel) weiter. Der Groq-Key bleibt hier, geht nie ans Frontend.

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const incomingForm = await req.formData()
    const audio = incomingForm.get('audio')
    if (!audio || !(audio instanceof File)) {
      return new Response(JSON.stringify({ error: 'audio fehlt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const groqForm = new FormData()
    groqForm.append('file', audio, audio.name || 'audio.webm')
    groqForm.append('model', 'whisper-large-v3')
    groqForm.append('language', 'de')
    groqForm.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY ?? ''}` },
      body: groqForm,
    })

    if (!response.ok) {
      const errText = await response.text()
      return new Response(JSON.stringify({ error: 'Groq API Fehler', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    return new Response(JSON.stringify({ text: (data.text ?? '').trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unerwarteter Fehler', detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
