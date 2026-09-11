import { expect, test } from 'vitest'
import { describeAlert, decideDelivery } from '../../src/alerts/alert.ts'
import type { AttemptOutcome, StoredTrigger } from '../../src/triggers/stored.ts'

const at = new Date(2026, 8, 9, 13, 30).getTime()
const workDay = { date: '2026-09-09', punches: ['08:32', '13:33'] }

const stored = (attempt: AttemptOutcome | undefined, marks: Partial<StoredTrigger> = {}): StoredTrigger => ({
  date: '2026-09-09',
  trigger: { slot: 2, at },
  ...(attempt ? { attempt: { at, decision: attempt } } : {}),
  ...marks,
})

test('announces the time the Punch reached the WorkDay, not the Trigger time', () => {
  expect(describeAlert({ result: 'confirmed', workDay, punch: '13:33' }, '2026-09-09', at)).toEqual({
    title: 'Ponto Automático — Marcação registrada',
    message: 'Marcação registrada às 13:33',
    priority: 'low',
    tags: ['white_check_mark'],
  })
})

test('titles an expired Trigger apart from a failed Attempt, and quotes the reason of both', () => {
  expect(describeAlert({ result: 'expired', reason: 'Motivo.' }, '2026-09-09', at)).toEqual({
    title: 'Ponto Automático — Gatilho vencido',
    message: 'Gatilho de 2026-09-09, 13:30:00. Motivo.',
    priority: 'urgent',
    tags: ['warning'],
  })
  expect(describeAlert({ result: 'button-disabled', reason: 'Motivo.' }, '2026-09-09', at)).toMatchObject({
    title: 'Ponto Automático — Falha na Tentativa',
    message: 'Gatilho de 2026-09-09, 13:30:00. Motivo.',
  })
})

test.each<AttemptOutcome>([
  { result: 'ready' },
  { result: 'disabled' },
  { result: 'already-filled', workDay },
  { result: 'read', workDay },
])('stays silent on an outcome that was foreseen and asked for nothing: %j', (outcome) => {
  expect(describeAlert(outcome, '2026-09-09', at)).toBeUndefined()
})

test('holds both channels until an Attempt has an outcome', () => {
  expect(decideDelivery(stored(undefined), '2026-09-09')).toEqual({ notify: false, push: false })
})

test('asks both channels for an outcome that speaks, and neither for a silent one', () => {
  expect(decideDelivery(stored({ result: 'confirmed', workDay, punch: '13:33' }), '2026-09-09')).toEqual({ notify: true, push: true })
  expect(decideDelivery(stored({ result: 'already-filled', workDay }), '2026-09-09')).toEqual({ notify: false, push: false })
})

test('lets each channel recover from its own failure', () => {
  const outcome: AttemptOutcome = { result: 'unconfirmed', reason: 'Motivo.' }

  expect(decideDelivery(stored(outcome, { notified: true }), '2026-09-09')).toEqual({ notify: false, push: true })
  expect(decideDelivery(stored(outcome, { pushed: true }), '2026-09-09')).toEqual({ notify: true, push: false })
  expect(decideDelivery(stored(outcome, { notified: true, pushed: true }), '2026-09-09')).toEqual({ notify: false, push: false })
})

test('gives up pushing a Trigger from an earlier day, and still notifies it', () => {
  expect(decideDelivery(stored({ result: 'expired', reason: 'Motivo.' }), '2026-09-10')).toEqual({ notify: true, push: false })
})
