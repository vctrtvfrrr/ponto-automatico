import type { WorkDay } from '../page/readers.ts'
import type { PageDecision, PageObservation, RegistrationDecision } from '../page/observation.ts'
import type { AttemptDecision } from './attempt.ts'
import { localDate, type Trigger } from './plan.ts'

export type PunchDecision =
  | { result: 'click'; workDay: WorkDay }
  | { result: 'already-filled'; workDay: WorkDay }
  | { result: 'schedule-unavailable' | 'date-changed'; reason: string }

export function decidePunch(trigger: Trigger, workDay: WorkDay, now: Date): PunchDecision {
  if (workDay.date !== localDate(now) || workDay.date !== localDate(new Date(trigger.at))) {
    return { result: 'date-changed', reason: 'A data da Jornada mudou. Nenhuma Marcação foi criada.' }
  }
  const window = trigger.window
  if (!window || !Number.isFinite(window.start) || !Number.isFinite(window.end) || window.start > trigger.at || window.end < trigger.at) {
    return {
      result: 'schedule-unavailable',
      reason: 'Este Gatilho não tem uma faixa de reconhecimento válida. Confira a Jornada e faça a Marcação manualmente. O próximo dia usará o novo planejamento.',
    }
  }
  const filled = workDay.punches.some((time) => {
    const [hours, minutes] = time.split(':').map(Number)
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours!, minutes!).getTime()
    return at >= window.start && at <= window.end
  })
  return { result: filled ? 'already-filled' : 'click', workDay }
}

export type ConfirmationDecision =
  | { result: 'confirmed'; workDay: WorkDay; punch: string }
  | { result: 'confirming' }
  | { result: 'unconfirmed'; reason: string }

export type PunchOutcome =
  | Exclude<AttemptDecision, { result: 'wait' | 'ready' }>
  | PageDecision
  | Exclude<PunchDecision, { result: 'click' }>
  | Exclude<RegistrationDecision, { result: 'ready' }>
  | Exclude<ConfirmationDecision, { result: 'confirming' }>
  | { result: 'interrupted' | 'stale-observation'; reason: string }

export function interruptedAttempt(): PunchOutcome {
  return {
    result: 'interrupted',
    reason: 'A Tentativa foi interrompida e não será repetida. Confira a Jornada no PontoMais antes de marcar manualmente.',
  }
}

export function decideConfirmation(
  before: WorkDay,
  observation: PageObservation,
  clickedAt: number,
  deadline: number,
  now: Date,
): ConfirmationDecision {
  if (now.getTime() <= deadline && observation.status === 'read' && observation.workDay.date === before.date) {
    const workDay = observation.workDay
    const clickMinute = Math.floor(clickedAt / 60_000) * 60_000
    const punch = workDay.punches.find((time) => {
      const at = new Date(`${workDay.date}T${time}:00`).getTime()
      return !before.punches.includes(time) && at >= clickMinute && at <= now.getTime()
    })
    if (punch && before.punches.every((time) => workDay.punches.includes(time))) return { result: 'confirmed', workDay, punch }
  }
  if (now.getTime() < deadline) return { result: 'confirming' }
  return {
    result: 'unconfirmed',
    reason: 'Não foi possível confirmar a Marcação. O clique não será repetido. Confira a Jornada no PontoMais antes de marcar manualmente.',
  }
}
