import type { WorkDay } from './readers.ts'

export type PageObservation = { status: 'login' } | { status: 'unreadable' } | { status: 'read'; workDay: WorkDay }

export type RegistrationObservation = 'ready' | 'missing' | 'disabled' | 'login'
export type RegistrationDecision =
  | { result: 'ready' }
  | { result: 'button-missing' | 'button-disabled' | 'login-required'; reason: string }

export function decideRegistration(observation: RegistrationObservation): RegistrationDecision {
  if (observation === 'ready') return { result: 'ready' }
  if (observation === 'login') {
    return { result: 'login-required', reason: 'A sessão do PontoMais expirou. Entre novamente no site. Nenhuma Marcação foi criada.' }
  }
  if (observation === 'disabled') {
    return { result: 'button-disabled', reason: 'O botão de Marcação está desabilitado. Confira a permissão e a validade da localização no site. Nenhuma Marcação foi criada.' }
  }
  return { result: 'button-missing', reason: 'O botão de Marcação não foi encontrado no PontoMais. A interface pode ter mudado. Nenhuma Marcação foi criada.' }
}

export type PageDecision =
  | { result: 'login-required' | 'page-unreadable'; reason: string }
  | { result: 'read'; workDay: WorkDay }

export function decidePageObservation(observation: PageObservation): PageDecision {
  if (observation.status === 'read') return { result: 'read', workDay: observation.workDay }
  if (observation.status === 'unreadable') {
    return {
      result: 'page-unreadable',
      reason: 'Não foi possível ler a Jornada no PontoMais dentro do tempo limite. Nenhuma Marcação foi criada.',
    }
  }
  return {
    result: 'login-required',
    reason: 'A sessão do PontoMais expirou. Entre novamente no site. Nenhuma Marcação foi criada.',
  }
}
