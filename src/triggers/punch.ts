import type { WorkDay } from '../page/readers.ts'
import type { PageObservation } from '../page/observation.ts'
import { localDate, type Trigger } from './plan.ts'

export type PunchDecision =
  | { result: 'click' | 'already-filled'; workDay: WorkDay }
  | { result: 'schedule-unavailable' | 'date-changed'; notification: string }

export function decidePunch(trigger: Trigger, workDay: WorkDay, now: Date): PunchDecision {
  if (workDay.date !== localDate(now) || workDay.date !== localDate(new Date(trigger.at))) {
    return { result: 'date-changed', notification: 'A data da Jornada mudou. Nenhuma Marcação foi criada.' }
  }
  const window = trigger.window
  if (!window || !Number.isFinite(window.start) || !Number.isFinite(window.end) || window.start > trigger.at || window.end < trigger.at) {
    return {
      result: 'schedule-unavailable',
      notification: 'Este Gatilho não tem uma faixa de reconhecimento válida. Confira a Jornada e faça a Marcação manualmente. O próximo dia usará o novo planejamento.',
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
  | { result: 'confirmed'; workDay: WorkDay }
  | { result: 'confirming' }
  | { result: 'unconfirmed'; notification: string }

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
    const newPunch = workDay.punches.some((time) => {
      const at = new Date(`${workDay.date}T${time}:00`).getTime()
      return !before.punches.includes(time) && at >= clickMinute && at <= now.getTime()
    })
    if (newPunch && before.punches.every((time) => workDay.punches.includes(time))) return { result: 'confirmed', workDay }
  }
  if (now.getTime() < deadline) return { result: 'confirming' }
  return {
    result: 'unconfirmed',
    notification: 'Não foi possível confirmar a Marcação. O clique não será repetido. Confira a Jornada no PontoMais antes de marcar manualmente.',
  }
}
