import type { Trigger } from './plan.ts'

export type AttemptDecision =
  | { result: 'wait' }
  | { result: 'ready' }
  | { result: 'expired'; notification: string }

export function decideAttempt(trigger: Trigger, toleranceMinutes: number, now: Date): AttemptDecision {
  if (now.getTime() < trigger.at) return { result: 'wait' }
  if (now.getTime() > trigger.at + toleranceMinutes * 60_000) {
    return {
      result: 'expired',
      notification: 'A janela de tolerância do Gatilho encerrou. Nenhuma Marcação foi criada.',
    }
  }
  return { result: 'ready' }
}
