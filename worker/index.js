// Chat con TellMe. Solo recibe /api/* (run_worker_first en wrangler.jsonc); lo demás son estáticos.
// La key de Gemini es un secreto del Worker (`wrangler secret put GEMINI_API_KEY`; en local, .dev.vars):
// nunca llega al navegador. El contexto son los mismos JSON que ya sirve la web.

const MODEL = 'gemini-flash-latest'
const MAX_QUESTION = 500
const MAX_TURNS = 6

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    bullets: { type: 'ARRAY', items: { type: 'STRING' } },
    followUps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['answer', 'bullets', 'followUps'],
}

const SYSTEM = `Eres TellMe, el asistente de salud financiera de Embat. Hablas con alguien que no es experto en finanzas.
Reglas:
- Responde en español, de tú, frases cortas y concretas. Explica cualquier término técnico en la misma frase.
- Usa SOLO los datos del contexto. Si la respuesta no está ahí, dilo claramente y sugiere qué sí puedes contestar.
- No inventes cifras: copia o redondea las del contexto.
- La salud va de 0 a 100 (más es mejor). Reconoce las mejoras igual que los problemas.
- "answer": 1-3 frases. "bullets": 0-4 puntos clave, con las cifras del contexto que respaldan la respuesta.
  "followUps": 2-3 preguntas cortas que el usuario podría hacer después.
- No des consejos de inversión personales; habla de la empresa y sus números.`

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
const fail = (status, code, message) => json({ error: { code, message } }, status)

async function asset(env, request, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url))
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
  return res.json()
}

/** Contexto compacto: lo que TellMe ya sabe de la empresa (o de la cartera), sin series largas. */
async function context(env, request, companyId) {
  if (!companyId) {
    const [tellme, portfolio, evidence] = await Promise.all([
      asset(env, request, '/data/tellme/portfolio.json'),
      asset(env, request, '/data/portfolio.json'),
      asset(env, request, '/data/evidence.json'),
    ])
    if (!portfolio) return null
    const rows = portfolio.rows
    const top = (cmp) => [...rows].sort(cmp).slice(0, 8)
      .map((r) => ({ id: r.companyId, salud: r.score, cambio3m: r.delta3m, señal: r.signal }))
    return {
      ambito: 'cartera', mes: portfolio.month, recuentos: portfolio.counts,
      evolucion: portfolio.history?.slice(-12), mas_caen: top((a, b) => a.delta3m - b.delta3m),
      mas_suben: top((a, b) => b.delta3m - a.delta3m), peor_salud: top((a, b) => a.score - b.score),
      fiabilidad_modelo: evidence, analisis_tellme: tellme,
    }
  }
  const base = `/data/companies/${companyId}`
  const [score, forecast, decisions, profile, tellme] = await Promise.all(
    ['score', 'forecast', 'decisions', 'profile', 'tellme'].map((f) => asset(env, request, `${base}/${f}.json`)),
  )
  if (!score) return null
  return {
    ambito: 'empresa', id: companyId,
    salud: score.score, banda: score.band, tendencia: score.trend, cambio_1m: score.delta1m, cambio_3m: score.delta3m,
    serie: score.series, motivos: score.drivers, metricas: score.metrics,
    prevision: forecast && { horizonte: forecast.horizon, estabilidad: forecast.stability, nota: forecast.stabilityNote, deteccion: forecast.detection },
    decisiones: decisions, ficha: profile && { datos: profile.facts, ahora: profile.now, cambios: profile.changes, tesoreria: profile.treasury.slice(-6), comparativa: profile.benchmark, escenarios: profile.scenarios.map(({ label, before, after }) => ({ label, before, after })) },
    analisis_tellme: tellme,
  }
}

async function ask(request, env) {
  if (!env.GEMINI_API_KEY) return fail(500, 'no_key', 'Falta GEMINI_API_KEY en el Worker.')
  let body
  try { body = await request.json() } catch { return fail(400, 'bad_request', 'El cuerpo no es JSON.') }
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const companyId = body?.companyId ?? null
  if (!question || question.length > MAX_QUESTION) return fail(400, 'bad_request', `La pregunta debe tener entre 1 y ${MAX_QUESTION} caracteres.`)
  if (companyId !== null && !/^COMP_\d{4}$/.test(companyId)) return fail(400, 'bad_request', 'companyId no válido.')
  const history = (Array.isArray(body?.history) ? body.history : []).slice(-MAX_TURNS)
    .filter((t) => (t?.role === 'user' || t?.role === 'model') && typeof t.text === 'string')
    .map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, 2000) }] }))

  const ctx = await context(env, request, companyId)
  if (!ctx) return fail(404, 'not_found', 'No hay datos para esa empresa.')

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM}\n\nCONTEXTO (JSON):\n${JSON.stringify(ctx)}` }] },
      contents: [...history, { role: 'user', parts: [{ text: question }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
    }),
  })
  if (res.status === 429) return fail(429, 'rate_limited', 'TellMe está recibiendo muchas preguntas. Prueba en unos segundos.')
  if (!res.ok) return fail(502, 'upstream', 'TellMe no ha podido responder ahora mismo.')
  const data = await res.json()
  try {
    const out = JSON.parse(data.candidates[0].content.parts.map((p) => p.text ?? '').join(''))
    return json({ ...out, model: env.GEMINI_MODEL || MODEL })
  } catch {
    return fail(502, 'upstream', 'TellMe ha devuelto una respuesta incompleta. Vuelve a preguntar.')
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/ask' && request.method === 'POST') return ask(request, env)
    return fail(404, 'not_found', 'Ruta desconocida.')
  },
}
