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
    // Opcional: lo que la web hace después de responder (abrir una empresa o cambiar de pestaña).
    action: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', enum: ['abrir_empresa', 'ir_a_pestaña', 'ninguna'] },
        companyId: { type: 'STRING' },
        tab: { type: 'STRING', enum: ['cartera', 'alertas', 'proveedores', 'modelo', 'empresa', 'empresa-proveedores'] },
        label: { type: 'STRING' },
      },
      required: ['type'],
    },
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
- No des consejos de inversión personales; habla de la empresa y sus números.
- Si te piden comparar empresas, di en qué se diferencian con cifras, no solo quién va mejor.
- Si te piden buscar ("cuáles cumplen X"), da la lista con su cifra; como mucho 10, y di cuántas hay en total.
- Si te piden escribir un correo o un mensaje para la empresa, escríbelo entero en "answer", listo para enviar,
  educado y concreto, y deja "bullets" vacío.
- "action" (opcional): si la respuesta se entiende mejor viendo una pantalla, pídela. "abrir_empresa" con su
  companyId cuando hablas sobre todo de una empresa; "ir_a_pestaña" cuando lo que cuentas vive en otra pestaña
  (alertas = quién se ha movido este mes, proveedores = bancos y conectores, modelo = cómo de fiable es).
  "label" es el texto del botón, corto y en infinitivo. Si no hace falta, "ninguna".`

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
const fail = (status, code, message) => json({ error: { code, message } }, status)

async function asset(env, request, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url))
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
  return res.json()
}

/** Filas de toda la cartera, recortadas: con esto puede buscar y comparar sin pedir nada más. */
function compactRows(rows) {
  return rows.map((r) => ({
    id: r.companyId, salud: r.score, banda: r.healthBand, trayectoria: r.trajectory, cambio3m: r.delta3m,
    cambio1m: r.delta1m, señal: r.signal, p_deterioro: r.pDeterioration, tamaño: r.sizeCohort,
    grupo: r.group, banco: r.bank, erp: r.erp,
    // Métricas de la empresa, con nombre en claro (portfolio.json las trae desde src/pulso.py).
    dias_en_cobrar: r.metrics?.dso, dias_en_pagar: r.metrics?.dpo, ciclo_de_caja: r.metrics?.ccc,
    cobertura_deuda: r.metrics?.dscr, dias_de_caja: r.metrics?.cash_days,
    uso_lineas_credito: r.metrics?.credit_usage, peso_mayor_cliente: r.metrics?.concentration,
  }))
}

/** Ficha de una empresa, para hablar de ella o compararla con otra. */
async function companyContext(env, request, companyId) {
  const base = `/data/companies/${companyId}`
  const [score, forecast, decisions, profile, tellme] = await Promise.all(
    ['score', 'forecast', 'decisions', 'profile', 'tellme'].map((f) => asset(env, request, `${base}/${f}.json`)),
  )
  if (!score) return null
  return {
    id: companyId,
    salud: score.score, banda: score.band, tendencia: score.trend, cambio_1m: score.delta1m, cambio_3m: score.delta3m,
    serie: score.series, motivos: score.drivers, metricas: score.metrics,
    prevision: forecast && { horizonte: forecast.horizon, estabilidad: forecast.stability, nota: forecast.stabilityNote, deteccion: forecast.detection },
    decisiones: decisions,
    ficha: profile && {
      datos: profile.facts, ahora: profile.now, cambios: profile.changes, tesoreria: profile.treasury.slice(-6),
      comparativa: profile.benchmark, escenarios: profile.scenarios.map(({ label, before, after }) => ({ label, before, after })),
    },
    analisis_tellme: tellme,
  }
}

/** Contexto compacto: cambia según la pestaña abierta, para que TellMe hable de lo que se está viendo. */
async function context(env, request, companyId, tab, companyIds) {
  // Comparación: varias empresas a la vez.
  if (companyIds && companyIds.length > 1) {
    const fichas = await Promise.all(companyIds.slice(0, 4).map((id) => companyContext(env, request, id)))
    const ok = fichas.filter(Boolean)
    return ok.length > 1 ? { ambito: 'comparación', empresas: ok } : null
  }
  if (tab === 'modelo') {
    const [model, evidence] = await Promise.all([
      asset(env, request, '/data/model.json'),
      asset(env, request, '/data/evidence.json'),
    ])
    if (!model) return null
    const { version, main_model, n_features, feature_blocks, holdout, lift, cv, calibration,
      shap_block_importance, top_features, error_analysis, anticipation, holdout_unseen_companies } = model
    return {
      ambito: 'modelo', version, modelo_servido: main_model, n_variables: n_features, bloques: feature_blocks,
      holdout, mejora_B_sobre_A: lift, validacion_cruzada: cv, calibracion: calibration,
      importancia_por_bloque: shap_block_importance, top_variables: top_features?.slice(0, 20),
      errores: error_analysis, anticipacion: anticipation, empresas_no_vistas: holdout_unseen_companies,
      resumen_evidencia: evidence,
    }
  }
  if (tab === 'proveedores' || tab === 'empresa-proveedores') {
    const prov = await asset(env, request, '/data/providers.json')
    if (!prov) return null
    const empresa = companyId ? await companyContext(env, request, companyId) : null
    return {
      ambito: 'proveedores', mes: prov.month, totales: prov.totals,
      proveedores: prov.providers.slice(0, 40).map(({ rows, ...p }) => p),
      empresa_abierta: empresa && { id: empresa.id, salud: empresa.salud, ficha: empresa.ficha?.datos },
    }
  }
  if (tab === 'alertas') {
    const [alerts, portfolio] = await Promise.all([
      asset(env, request, '/data/alerts.json'),
      asset(env, request, '/data/portfolio.json'),
    ])
    if (!alerts) return null
    return {
      ambito: 'alertas', recuentos: portfolio?.counts,
      alertas: alerts.slice(0, 120).map((a) => ({
        id: a.companyId, señal: a.signal, salud: a.score, cambio1m: a.delta1m, cambio3m: a.delta,
        meses_antes: a.monthsAhead, que_cambio: a.why,
      })),
    }
  }
  if (companyId) {
    const empresa = await companyContext(env, request, companyId)
    if (!empresa) return null
    return { ambito: 'empresa', ...empresa }
  }
  {
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
      // Todas las empresas, recortadas: permite buscar ("cuáles tienen X") sin más peticiones.
      todas_las_empresas: compactRows(rows),
    }
  }
}

async function ask(request, env) {
  if (!env.GEMINI_API_KEY) return fail(500, 'no_key', 'Falta GEMINI_API_KEY en el Worker.')
  let body
  try { body = await request.json() } catch { return fail(400, 'bad_request', 'El cuerpo no es JSON.') }
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const companyId = body?.companyId ?? null
  const tab = typeof body?.tab === 'string' ? body.tab : null
  const companyIds = Array.isArray(body?.companyIds) ? body.companyIds.filter((x) => /^COMP_\d{4}$/.test(x)).slice(0, 4) : null
  if (!question || question.length > MAX_QUESTION) return fail(400, 'bad_request', `La pregunta debe tener entre 1 y ${MAX_QUESTION} caracteres.`)
  if (companyId !== null && !/^COMP_\d{4}$/.test(companyId)) return fail(400, 'bad_request', 'companyId no válido.')
  const history = (Array.isArray(body?.history) ? body.history : []).slice(-MAX_TURNS)
    .filter((t) => (t?.role === 'user' || t?.role === 'model') && typeof t.text === 'string')
    .map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, 2000) }] }))

  const ctx = await context(env, request, companyId, tab, companyIds)
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
