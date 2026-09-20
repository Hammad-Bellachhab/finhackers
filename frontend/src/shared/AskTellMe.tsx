import { useEffect, useId, useRef, useState } from 'react'
import { askTellMe } from '../api'
import type { AskAction, AskResponse, ChatTurn } from '../api/types'
import { TellMeLogo, TellMeWordmark } from './TellMeLogo'
import './ask-tellme.css'

type Msg = { role: 'user'; text: string } | { role: 'model'; text: string; data: AskResponse } | { role: 'error'; text: string }

/** Cada pestaña pregunta otras cosas: TellMe responde con los datos de lo que se está viendo. */
const SUGERENCIAS: Record<string, string[]> = {
  cartera: [
    '¿Qué empresas me deberían preocupar hoy?',
    '¿Cuáles dependen demasiado de un solo cliente y van justas de caja?',
    '¿Quién está mejorando?',
  ],
  alertas: [
    '¿Cuál es la alerta más urgente y por qué?',
    '¿Cuántas se vieron venir con antelación?',
    'Escríbeme el aviso para la peor de ellas',
  ],
  proveedores: [
    '¿Qué banco tiene la cartera más tocada?',
    '¿Dónde está concentrada la financiación?',
    'Compara Santander con BBVA',
  ],
  modelo: [
    '¿En qué se fija el modelo?',
    '¿Cuánto acierta con empresas que no ha visto nunca?',
    '¿Dónde se equivoca?',
  ],
  empresa: [
    '¿Cómo está esta empresa, en pocas palabras?',
    '¿Por qué ha cambiado su salud?',
    'Escríbeme un correo para avisarles',
  ],
  'empresa-proveedores': [
    '¿Con qué bancos trabaja y cuánto debe a cada uno?',
    '¿Está muy concentrada en un proveedor?',
    '¿Qué le pediría a su banco principal?',
  ],
}

/** Chat con TellMe: notch fijo abajo en el centro. Habla de lo que hay en pantalla: cada pestaña
 *  le llega con sus datos, y puede proponer abrir una empresa o cambiar de pestaña. */
export function AskTellMe({
  tab = 'cartera', companyId, companyIds, onAction, onLimpiarComparar,
}: {
  tab?: string
  companyId?: string
  /** Empresas marcadas en la tabla: TellMe las compara. */
  companyIds?: string[]
  onAction?: (a: AskAction) => void
  onLimpiarComparar?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const panelId = useId()

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }) }, [msgs, busy])
  useEffect(() => { if (open) input.current?.focus() }, [open])

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    const history: ChatTurn[] = msgs.flatMap((m) => (m.role === 'error' ? [] : [{ role: m.role, text: m.text }]))
    setMsgs((v) => [...v, { role: 'user', text: question }])
    setQ('')
    setBusy(true)
    try {
      const data = await askTellMe(question, { tab, companyId, companyIds }, history)
      setMsgs((v) => [...v, { role: 'model', text: data.answer, data }])
    } catch (e) {
      setMsgs((v) => [...v, { role: 'error', text: e instanceof Error ? e.message : String(e) }])
    } finally {
      setBusy(false)
    }
  }

  const last = [...msgs].reverse().find((m) => m.role === 'model')
  const sugerencias = last?.role === 'model' ? last.data.followUps
    : companyIds ? ['Compáralas: ¿en qué se diferencian?', '¿Cuál preocupa más y por qué?', '¿Qué haría con cada una?']
    : (SUGERENCIAS[tab] ?? SUGERENCIAS.cartera)

  return (
    <div className={`ask ${open ? 'ask-open' : ''} ${busy ? 'ask-thinking tellme-spin' : ''}`} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      {open && (
        <section id={panelId} className="ask-panel" aria-label="Chat con TellMe">
          <header className="ask-head">
            <span className="tellme-mark" aria-hidden="true">
              <TellMeLogo size={20} />
            </span>
            <TellMeWordmark />
            <span className="ask-sub">
              {companyIds ? `comparando ${companyIds.length} empresas` : 'tu analista financiero'}
            </span>
            {companyIds && onLimpiarComparar && (
              <button type="button" className="ask-action ask-action-inline" onClick={onLimpiarComparar}>Quitar</button>
            )}
            <button type="button" className="ask-close" aria-label="Cerrar el chat" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="ask-list" ref={list} aria-live="polite">
            {msgs.length === 0 && (
              <p className="ask-empty">
                Pregúntame lo que quieras. Respondo con los datos del motor, en lenguaje llano.
              </p>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ask-msg ask-${m.role}`}>
                <p>{m.text}</p>
                {m.role === 'model' && m.data.bullets.length > 0 && (
                  <ul>{m.data.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                )}
                {m.role === 'model' && m.data.action && m.data.action.type !== 'ninguna' && onAction && (
                  <button
                    type="button" className="ask-action"
                    onClick={() => { onAction(m.data.action!); setOpen(false) }}
                  >
                    {m.data.action.label ?? 'Verlo en la web'} →
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="ask-msg ask-model ask-typing" aria-label="TellMe está pensando"><span /><span /><span /></div>}
          </div>

          {!busy && (
            <div className="ask-suggest">
              {sugerencias.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          )}

          <form className="ask-form" onSubmit={(e) => { e.preventDefault(); send(q) }}>
            <input
              ref={input} value={q} maxLength={500} placeholder="Pregúntale a TellMe…"
              aria-label="Tu pregunta para TellMe" onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="ask-send" disabled={!q.trim() || busy}>Enviar</button>
          </form>
        </section>
      )}

      <button
        type="button" className="ask-notch" aria-expanded={open} aria-controls={panelId}
        aria-label={open ? 'Cerrar el chat con TellMe' : 'Abrir el chat con TellMe'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tellme-mark" aria-hidden="true">
          <TellMeLogo size={22} />
        </span>
        <TellMeWordmark />
      </button>
    </div>
  )
}
