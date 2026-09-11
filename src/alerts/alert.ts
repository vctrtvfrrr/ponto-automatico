import { localDate } from '../triggers/plan.ts'
import type { AttemptOutcome, StoredTrigger } from '../triggers/stored.ts'

export type Alert = {
  title: string
  message: string
  priority: 'low' | 'urgent'
  tags: string[]
}

export type Delivery = { notify: boolean; push: boolean }

const TITLE = 'Ponto Automático'

// How long a failed push holds every other push back. Every wake walks all of
// today's Triggers, and opening the popup causes a wake, so without a shared
// floor the volume follows the number of wakes rather than the number of
// Alerts — and ntfy.sh answers that with 429 and then a ban.
export const PUSH_BACKOFF_MS = 5 * 60_000

export function describeAlert(outcome: AttemptOutcome, date: string, at: number): Alert | undefined {
  if (outcome.result === 'confirmed') {
    // A success stored before this version carries no Punch and was silent when
    // it happened. Announcing it now, days late and without the time it would
    // report, is noise.
    if (!outcome.punch) return undefined

    return {
      title: `${TITLE} — Marcação registrada`,
      message: `Marcação registrada às ${outcome.punch}`,
      priority: 'low',
      tags: ['white_check_mark'],
    }
  }

  const reason = reasonOf(outcome)
  if (reason === undefined) return undefined

  return {
    title: `${TITLE} — ${outcome.result === 'expired' ? 'Gatilho vencido' : 'Falha na Tentativa'}`,
    message: `Gatilho de ${date}, ${new Date(at).toLocaleTimeString('pt-BR')}. ${reason}`,
    priority: 'urgent',
    tags: ['warning'],
  }
}

// A failure stored before the rename carries `notification`, and the version
// that wrote it would still have delivered it on the next wake.
function reasonOf(outcome: AttemptOutcome): string | undefined {
  if ('reason' in outcome) return outcome.reason
  const legacy: unknown = (outcome as { notification?: unknown }).notification

  return typeof legacy === 'string' ? legacy : undefined
}

// Only today's Trigger pushes, and only once the last failure's floor has
// passed. Nothing prunes the stored Triggers, so the date rule also keeps
// enabling the channel from pushing the whole history.
export function decideDelivery(stored: StoredTrigger, now: Date, pushAllowedAt: number): Delivery {
  const outcome = stored.attempt?.decision
  if (!outcome || !describeAlert(outcome, stored.date, stored.trigger.at)) {
    return { notify: false, push: false }
  }

  return {
    notify: !stored.notified,
    push: !stored.pushed && stored.date === localDate(now) && now.getTime() >= pushAllowedAt,
  }
}
