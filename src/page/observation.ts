import type { WorkDay } from './readers.ts'

export type PageObservation = { status: 'login' } | { status: 'unreadable' } | { status: 'read'; workDay: WorkDay }

export type PageDecision =
  | { result: 'login-required' | 'page-unreadable'; notification: string }
  | { result: 'read'; workDay: WorkDay }

export function decidePageObservation(observation: PageObservation): PageDecision {
  if (observation.status === 'read') return { result: 'read', workDay: observation.workDay }
  if (observation.status === 'unreadable') {
    return {
      result: 'page-unreadable',
      notification: 'Não foi possível ler a Jornada no PontoMais dentro do tempo limite. Nenhuma Marcação foi criada.',
    }
  }
  return {
    result: 'login-required',
    notification: 'A sessão do PontoMais expirou. Entre novamente no site. Nenhuma Marcação foi criada.',
  }
}
