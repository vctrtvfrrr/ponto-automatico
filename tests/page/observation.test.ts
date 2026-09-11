import { expect, test } from 'vitest'
import { decidePageObservation, decideRegistration } from '../../src/page/observation.ts'

test('aborts and notifies when the Punch button is absent or disabled', () => {
  expect(decideRegistration('missing')).toMatchObject({ result: 'button-missing', reason: expect.any(String) })
  expect(decideRegistration('disabled')).toMatchObject({ result: 'button-disabled', reason: expect.any(String) })
  expect(decideRegistration('login')).toMatchObject({ result: 'login-required', reason: expect.any(String) })
  expect(decideRegistration('ready')).toEqual({ result: 'ready' })
})

test('aborts and asks the user to log in when the page shows login', () => {
  expect(decidePageObservation({ status: 'login' })).toEqual({
    result: 'login-required',
    reason: 'A sessão do PontoMais expirou. Entre novamente no site. Nenhuma Marcação foi criada.',
  })
})

test('aborts and notifies when the page remains unreadable at the deadline', () => {
  expect(decidePageObservation({ status: 'unreadable' })).toEqual({
    result: 'page-unreadable',
    reason: 'Não foi possível ler a Jornada no PontoMais dentro do tempo limite. Nenhuma Marcação foi criada.',
  })
})

test.each([{ punches: [] }, { punches: ['09:02', '12:07', '13:11', '18:04'] }])('records the observed WorkDay without claiming a new Punch: $punches', ({ punches }) => {
  const workDay = { date: '2026-03-03', punches }
  expect(decidePageObservation({ status: 'read', workDay })).toEqual({ result: 'read', workDay })
})
