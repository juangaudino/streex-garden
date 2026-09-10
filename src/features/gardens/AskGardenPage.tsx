import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, MessageCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { AttentionItem, ControlProjection, GardenHarvestRecord } from '../../domain/types'
import { resolveAskGardenIntent } from '../../domain/ask-garden'
import { askGarden, aiGatewayStatus } from '../../lib/ai-gateway'
import { getAttention, getControlV2, getHarvestHistory } from '../../lib/garden-api'

type Message = { id: string; question: string; answer: string; sources: string[]; action?: { label: string; to: string }; mode: 'deterministic' | 'ai' }

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function harvestDate(value: string): string {
  return new Intl.DateTimeFormat('es-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function deterministicAnswer(question: string, control: ControlProjection, attention: AttentionItem[], harvests: GardenHarvestRecord[]): Omit<Message, 'id' | 'question' | 'mode'> {
  const intent = resolveAskGardenIntent(question)
  if (intent === 'today_attention') {
    if (attention.length === 0) return { answer: '🟢 Nada requiere tu atención hoy.', sources: ['Atención vigente'] }
    return { answer: attention.slice(0, 8).map((item) => `• ${item.title}${item.due_on ? ` · ${item.due_on}` : ''}`).join('\n'), sources: ['Atención vigente'], action: { label: 'Abrir Hoy', to: '/today' } }
  }
  if (intent === 'missing_germination') {
    const missing = control.positions.filter((position) => position.grow_cycle_id && position.germination?.status !== 'confirmed')
    if (missing.length === 0) return { answer: 'Todas las posiciones con ciclo activo tienen germinación confirmada en el estado actual.', sources: ['Control V2'] }
    return { answer: missing.map((position) => `• Posición ${position.position.number}${position.plant?.name ? ` · ${position.plant.name}` : ''}`).join('\n'), sources: ['Control V2'], action: { label: 'Abrir Control V2', to: '/control' } }
  }
  if (intent === 'harvest_candidates') {
    const candidates = control.positions.filter((position) => ['evaluate', 'ready'].includes(position.harvest_readiness?.value ?? ''))
    if (candidates.length === 0) return { answer: 'No hay ciclos con una evaluación de cosecha pendiente en el estado actual.', sources: ['Control V2'] }
    return { answer: candidates.map((position) => `• Posición ${position.position.number}${position.plant?.name ? ` · ${position.plant.name}` : ''} · ${position.harvest_readiness?.value === 'ready' ? 'lista para evaluar' : 'conviene evaluar'}`).join('\n'), sources: ['Control V2'], action: { label: 'Abrir Control V2', to: '/control' } }
  }
  if (intent === 'last_harvest') {
    const normalizedQuestion = normalizeSearch(question)
    const matching = harvests.find((harvest) => normalizedQuestion.includes(normalizeSearch(harvest.crop_name)))
    const latest = matching ?? harvests[0]
    if (!latest) return { answer: 'No hay cosechas registradas en Garden X.', sources: ['Historial de Grow Cycle'] }
    if (!matching && harvests.length > 1) return { answer: 'Indica el nombre de la planta para localizar su última cosecha.', sources: ['Historial de Grow Cycle'] }
    return {
      answer: `La última cosecha registrada de ${latest.crop_name} fue el ${harvestDate(latest.occurred_on)} · ${latest.garden_name} · Pod ${latest.position_number ?? 'sin posición'}.`,
      sources: ['Historial de Grow Cycle'],
      action: latest.grow_cycle_id ? { label: 'Abrir ciclo', to: `/cycle/${latest.grow_cycle_id}` } : undefined,
    }
  }
  if (intent === 'recent_changes') return { answer: 'Las novedades confirmadas se muestran en Home, en “Desde la última vez”.', sources: ['Home Dashboard'], action: { label: 'Abrir Home', to: '/' } }
  if (intent === 'cycle_history') return { answer: 'Para contar la historia completa necesito que indiques el Garden y el Pod. Puedes abrir un ciclo y consultar su Historial o Plant Story.', sources: ['Garden X'], action: { label: 'Ver jardines', to: '/gardens' } }
  if (intent === 'open_incidents') return { answer: 'Las incidencias abiertas se consultan por ciclo. Abre el Garden y selecciona el Pod para ver sus registros confirmados.', sources: ['Historial de Grow Cycle'], action: { label: 'Ver jardines', to: '/gardens' } }
  return { answer: 'Puedo responder sobre tus jardines, ciclos, atención, germinación, cosechas e historial. Prueba una pregunta más concreta.', sources: ['Garden X'] }
}

export function AskGardenPage() {
  const [control, setControl] = useState<ControlProjection | null>(null)
  const [attention, setAttention] = useState<AttentionItem[]>([])
  const [harvests, setHarvests] = useState<GardenHarvestRecord[]>([])
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const [nextControl, nextAttention, nextHarvests] = await Promise.all([getControlV2(), getAttention(), getHarvestHistory()]); setControl(nextControl); setAttention(nextAttention); setHarvests(nextHarvests) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo preparar Ask Garden.') }
    finally { setLoading(false) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the canonical RPCs settle.
  useEffect(() => { void load() }, [load])
  useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])
  const suggestions = useMemo(() => {
    const base = attention.length > 0 ? ['¿Qué tengo pendiente hoy?'] : ['¿Qué todavía no tiene germinación confirmada?']
    return [...base, '¿Qué posiciones todavía no tienen germinación confirmada?', '¿Hay algo que valga la pena evaluar para cosecha?'].filter((value, index, all) => all.indexOf(value) === index).slice(0, 3)
  }, [attention.length])
  const submit = async (value = question) => {
    if (!control || value.trim().length < 2 || busy) return
    setBusy(true); setError(null)
    try {
      const intent = resolveAskGardenIntent(value)
      let result: Omit<Message, 'id' | 'question' | 'mode'> & { mode?: Message['mode'] }
      if (intent !== 'needs_clarification' || aiGatewayStatus() === 'disabled') result = deterministicAnswer(value, control, attention, harvests)
      else {
        const answer = await askGarden({ question: value, requestKey: `ask-garden:${crypto.randomUUID()}`, conversation: messages.slice(-4).map((message) => ({ question: message.question.slice(0, 300), answer: message.answer.slice(0, 500) })) })
        result = { answer: answer.answer, sources: answer.confirmed_facts.map((fact) => fact.source.kind), mode: 'ai' }
      }
      setMessages((current) => [...current, { id: crypto.randomUUID(), question: value.trim(), ...result, mode: result.mode ?? 'deterministic' }])
      setQuestion('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ask Garden no está disponible ahora.') }
    finally { setBusy(false) }
  }
  return <AppShell title="Ask Garden" subtitle="Tu jardín, en contexto." actions={<button className="secondary-button secondary-button--compact" type="button" onClick={() => { setMessages([]); setQuestion('') }}><RefreshCw size={15} aria-hidden="true" /> Nueva sesión</button>}>
    <section className="ask-garden-hero"><Sparkles size={20} aria-hidden="true" /><div><h2>Pregúntame sobre tus jardines</h2><p>Primero consulto los datos confirmados de Garden X. Las respuestas de IA, cuando estén habilitadas, nunca cambian tus registros.</p></div></section>
    {loading && <StatePanel kind="loading" title="Preparando contexto de tu jardín" />}
    {error && <StatePanel kind="error" title="Ask Garden no está disponible" onRetry={() => void load()}>{error}</StatePanel>}
    {control && <section className="ask-garden-chat" aria-label="Conversación con Ask Garden">
      <div className="ask-garden-thread" aria-live="polite">{messages.length === 0 && <div className="ask-garden-empty"><MessageCircle size={22} aria-hidden="true" /><p>Pregunta por tu jardín. Usaré primero los datos confirmados.</p><div className="ask-garden-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setQuestion(suggestion); void submit(suggestion) }}>{suggestion}</button>)}</div></div>}{messages.map((message) => <article key={message.id} className="ask-garden-message"><p className="ask-garden-question">{message.question}</p><div className="ask-garden-answer"><p>{message.answer}</p><small>{message.mode === 'ai' ? 'Interpretación de Garden AI · ' : ''}Basado en {message.sources.filter(Boolean).join(' · ') || 'Garden X'}</small>{message.action && <Link className="text-link" to={message.action.to}>{message.action.label} <ArrowRight size={14} aria-hidden="true" /></Link>}</div></article>)}{busy && <article className="ask-garden-message"><div className="ask-garden-answer ask-garden-answer--loading">Consultando Garden X…</div></article>}<div ref={threadEndRef} /></div>
      <form className="ask-garden-compose" onSubmit={(event) => { event.preventDefault(); void submit() }}><label className="sr-only" htmlFor="ask-garden-input">Pregunta para Ask Garden</label><textarea id="ask-garden-input" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} placeholder="Pregunta sobre tus jardines…" rows={1} maxLength={2000} /><button className="primary-button" type="submit" disabled={busy || question.trim().length < 2}><MessageCircle size={17} aria-hidden="true" />{busy ? 'Consultando…' : 'Enviar'}</button></form>
    </section>}
  </AppShell>
}
