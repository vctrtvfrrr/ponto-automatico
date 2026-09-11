import type { AttemptOutcome, StoredTrigger } from '../triggers/stored.ts'

export type Alert = {
  title: string
  message: string
  priority: 'low' | 'urgent'
  tags: string[]
}

export type Delivery = { notify: boolean; push: boolean }

const TITLE = 'Ponto Automático'

export function describeAlert(outcome: AttemptOutcome, date: string, at: number): Alert | undefined {
  if (outcome.result === 'confirmed') {
    return {
      title: `${TITLE} — Marcação registrada`,
      message: `Marcação registrada às ${outcome.punch}`,
      priority: 'low',
      tags: ['white_check_mark'],
    }
  }
  if (!('reason' in outcome)) return undefined

  return {
    title: `${TITLE} — ${outcome.result === 'expired' ? 'Gatilho vencido' : 'Falha na Tentativa'}`,
    message: `Gatilho de ${date}, ${new Date(at).toLocaleTimeString('pt-BR')}. ${outcome.reason}`,
    priority: 'urgent',
    tags: ['warning'],
  }
}

// Only today's Trigger pushes. Nothing prunes the stored Triggers, and every
// wake walks all of them: without this, an unreachable ntfy would mean one POST
// per past Trigger per wake, which its rate limit answers with a ban. It also
// keeps enabling the channel from pushing the whole history.
export function decideDelivery(stored: StoredTrigger, today: string): Delivery {
  const outcome = stored.attempt?.decision
  if (!outcome || !describeAlert(outcome, stored.date, stored.trigger.at)) {
    return { notify: false, push: false }
  }

  return { notify: !stored.notified, push: !stored.pushed && stored.date === today }
}
