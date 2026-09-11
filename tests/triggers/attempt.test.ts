import { expect, test } from 'vitest'
import { decideAttempt } from '../../src/triggers/attempt.ts'

const trigger = { slot: 0, at: new Date(2026, 8, 9, 8, 30).getTime() }

test('skips a scheduled Trigger while automation is disabled', () => {
  expect(decideAttempt(trigger, 15, new Date(2026, 8, 9, 8, 35), { enabled: false })).toEqual({ result: 'disabled' })
})

test('does not catch up a Trigger after resuming, even inside tolerance', () => {
  const automation = { enabled: true, resumedAt: new Date(2026, 8, 9, 8, 31).getTime() }

  expect(decideAttempt(trigger, 15, new Date(2026, 8, 9, 8, 35), automation)).toEqual({ result: 'disabled' })
})

test('only resumes Triggers strictly after the instant automation was enabled', () => {
  const now = new Date(2026, 8, 9, 8, 35)

  expect(decideAttempt(trigger, 15, now, { enabled: true, resumedAt: trigger.at })).toEqual({ result: 'disabled' })
  expect(decideAttempt(trigger, 15, now, { enabled: true, resumedAt: trigger.at - 1 })).toEqual({ result: 'ready' })
})

test('waits for a future Trigger instead of consuming it on an early alarm during a pause', () => {
  expect(decideAttempt(trigger, 15, new Date(trigger.at - 1), { enabled: false })).toEqual({ result: 'wait' })
})

test('does not report expiration for a Trigger skipped by the kill switch', () => {
  expect(decideAttempt(trigger, 15, new Date(2026, 8, 9, 9), { enabled: false })).toEqual({ result: 'disabled' })
})

test('proceeds at the exact opening of the tolerance window', () => {
  expect(decideAttempt(trigger, 15, new Date(2026, 8, 9, 8, 30))).toEqual({ result: 'ready' })
})

test('waits one millisecond before the tolerance window opens', () => {
  expect(decideAttempt(trigger, 15, new Date(2026, 8, 9, 8, 29, 59, 999))).toEqual({ result: 'wait' })
})

test('aborts and explains the failure one millisecond after the tolerance window closes', () => {
  expect(decideAttempt(trigger, 15, new Date(2026, 8, 9, 8, 45, 0, 1))).toEqual({
    result: 'expired',
    reason: 'A janela de tolerância do Gatilho encerrou. Nenhuma Marcação foi criada.',
  })
})

test.each([
  new Date(2026, 8, 9, 8, 30, 0, 1),
  new Date(2026, 8, 9, 8, 40),
  new Date(2026, 8, 9, 8, 44, 59, 999),
  new Date(2026, 8, 9, 8, 45),
])('proceeds inside the tolerance window, including its exact closing instant: %s', (now) => {
  expect(decideAttempt(trigger, 15, now)).toEqual({ result: 'ready' })
})

test('uses the configured tolerance from the drawn Trigger, not the nominal Schedule time', () => {
  const drawn = { slot: 0, at: new Date(2026, 8, 9, 8, 37).getTime() }

  expect(decideAttempt(drawn, 2, new Date(2026, 8, 9, 8, 39))).toEqual({ result: 'ready' })
  expect(decideAttempt(drawn, 2, new Date(2026, 8, 9, 8, 39, 0, 1)).result).toBe('expired')
})

test('zero tolerance allows only the exact drawn instant', () => {
  expect(decideAttempt(trigger, 0, new Date(2026, 8, 9, 8, 29, 59, 999)).result).toBe('wait')
  expect(decideAttempt(trigger, 0, new Date(2026, 8, 9, 8, 30)).result).toBe('ready')
  expect(decideAttempt(trigger, 0, new Date(2026, 8, 9, 8, 30, 0, 1)).result).toBe('expired')
})

test('keeps the tolerance window across midnight', () => {
  const late = { slot: 3, at: new Date(2026, 8, 9, 23, 55).getTime() }

  expect(decideAttempt(late, 15, new Date(2026, 8, 10, 0, 10))).toEqual({ result: 'ready' })
  expect(decideAttempt(late, 15, new Date(2026, 8, 10, 0, 10, 0, 1)).result).toBe('expired')
})
