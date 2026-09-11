import type { AutomationState } from '../automation/state.ts'
import type { Trigger } from './plan.ts'

export type AttemptDecision =
  | { result: 'wait' }
  | { result: 'ready' }
  | { result: 'disabled' }
  | { result: 'expired'; reason: string }

export function decideAttempt(
  trigger: Trigger,
  toleranceMinutes: number,
  now: Date,
  automation: AutomationState = { enabled: true },
): AttemptDecision {
  if (now.getTime() < trigger.at) return { result: 'wait' }
  if (!automation.enabled || (automation.resumedAt !== undefined && trigger.at <= automation.resumedAt)) {
    return { result: 'disabled' }
  }
  if (now.getTime() > trigger.at + toleranceMinutes * 60_000) {
    return {
      result: 'expired',
      reason: 'A janela de tolerância do Gatilho encerrou. Nenhuma Marcação foi criada.',
    }
  }
  return { result: 'ready' }
}
