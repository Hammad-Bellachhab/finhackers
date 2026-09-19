import { useEffect, useId, useRef, useState } from 'react'
import { askTellMe } from '../api'
import { companyName } from '../api/mock/names'
import type { AskResponse, ChatTurn } from '../api/types'
import './ask-tellme.css'

type Msg = { role: 'user'; text: string } | { role: 'model'; text: string; data: AskResponse } | { role: 'error'; text: string }

const SUGERENCIAS = {
  empresa: ['¿Cómo está esta empresa, en pocas palabras?', '¿Por qué ha cambiado su salud?', '¿Qué debería hacer primero?'],
  cartera: ['¿Qué empresas me deberían preocupar hoy?', '¿Quién está mejorando?', '¿Cómo ha evolucionado la cartera este año?'],
}

/** Chat con TellMe: notch fijo abajo en el centro. El contexto es la empresa abierta o la cartera. */
export function AskTellMe({ companyId }: { companyId?: string }) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const ambito = companyId ? companyName(companyId) : 'tu cartera'

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
      const data = await askTellMe(question, companyId, history)
      setMsgs((v) => [...v, { role: 'model', text: data.answer, data }])
    } catch (e) {
      setMsgs((v) => [...v, { role: 'error', text: e instanceof Error ? e.message : String(e) }])
    } finally {
      setBusy(false)
    }
  }

  const last = [...msgs].reverse().find((m) => m.role === 'model')
  const sugerencias = last?.role === 'model' ? last.data.followUps : SUGERENCIAS[companyId ? 'empresa' : 'cartera']

  return (
    <div className={`ask ${open ? 'ask-open' : ''}`} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
      {open && (
        <section id={panelId} className="ask-panel" aria-label="Chat con TellMe">
          <header className="ask-head">
            <span className="tellme-mark" aria-hidden="true">✦</span>
            <strong>TellMe</strong>
            <span className="muted">· sobre {ambito}</span>
            <button type="button" className="ask-close" aria-label="Cerrar el chat" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="ask-list" ref={list} aria-live="polite">
            {msgs.length === 0 && (
              <p className="ask-empty">
                Pregúntame lo que quieras sobre {ambito}. Respondo solo con los datos del motor, en lenguaje llano.
              </p>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ask-msg ask-${m.role}`}>
                <p>{m.text}</p>
                {m.role === 'model' && m.data.bullets.length > 0 && (
                  <ul>{m.data.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                )}
                {m.role === 'model' && m.data.evidence.length > 0 && (
                  <dl className="tellme-evidence">
                    {m.data.evidence.map((ev, j) => <div key={j}><dt>{ev.label}</dt><dd>{ev.value}</dd></div>)}
                  </dl>
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
              ref={input} value={q} maxLength={500} placeholder={`Pregunta sobre ${ambito}…`}
              aria-label="Tu pregunta para TellMe" onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" className="ask-send" disabled={!q.trim() || busy}>Enviar</button>
          </form>
          <p className="ask-note">TellMe es una IA: revisa las cifras importantes.</p>
        </section>
      )}

      <button
        type="button" className="ask-notch" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tellme-mark" aria-hidden="true">✦</span>
        {open ? 'Cerrar TellMe' : <>Pregúntale a TellMe <span className="muted">· {ambito}</span></>}
      </button>
    </div>
  )
}
