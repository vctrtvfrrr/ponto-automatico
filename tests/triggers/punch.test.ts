import { expect, test } from 'vitest'
import { decideConfirmation, decidePunch } from '../../src/triggers/punch.ts'
import type { PageObservation } from '../../src/page/observation.ts'

const at = (hours: number, minutes: number) => new Date(2026, 8, 9, hours, minutes).getTime()
const trigger = { slot: 2, at: at(13, 30), window: { start: at(13, 15), end: at(13, 45) } }
const now = new Date(trigger.at)

test('skips a nearby manual Punch even when an earlier Schedule time has no Punch', () => {
  const workDay = { date: '2026-09-09', punches: ['08:32', '13:29'] }

  expect(decidePunch(trigger, workDay, now)).toEqual({ result: 'already-filled', workDay })
})

test.each(['13:15', '13:45'])('recognizes the inclusive deviation boundary %s', (time) => {
  const workDay = { date: '2026-09-09', punches: [time] }
  expect(decidePunch(trigger, workDay, now)).toEqual({ result: 'already-filled', workDay })
})

test.each([[], ['08:32'], ['13:14'], ['13:46']])('allows a Punch when none is inside the recognition window: %j', (...punches) => {
  const workDay = { date: '2026-09-09', punches }
  expect(decidePunch(trigger, workDay, now)).toEqual({ result: 'click', workDay })
})

test('does not guess the recognition window of a Trigger saved by an older version', () => {
  expect(decidePunch({ slot: 2, at: trigger.at }, { date: '2026-09-09', punches: [] }, now)).toMatchObject({
    result: 'schedule-unavailable', notification: expect.any(String),
  })
})

test('does not create a Punch for yesterday after the date changes during an Attempt', () => {
  expect(decidePunch(trigger, { date: '2026-09-09', punches: [] }, new Date(2026, 8, 10))).toMatchObject({
    result: 'date-changed', notification: expect.any(String),
  })
})

test('rejects a WorkDay from another date', () => {
  expect(decidePunch(trigger, { date: '2026-09-08', punches: ['13:29'] }, now).result).toBe('date-changed')
})

test('confirms a new Punch read after the click, including a late Attempt outside the draw window', () => {
  const before = { date: '2026-09-09', punches: ['08:32', '12:01'] }
  const workDay = { ...before, punches: [...before.punches, '13:50'] }
  const clickedAt = at(13, 50) + 15_000

  expect(decideConfirmation(before, { status: 'read', workDay }, clickedAt, clickedAt + 60_000, new Date(clickedAt + 2_000)))
    .toEqual({ result: 'confirmed', workDay })
})

test.each<PageObservation>([
  { status: 'unreadable' },
  { status: 'login' },
  { status: 'read', workDay: { date: '2026-09-09', punches: ['08:32', '13:29'] } },
  { status: 'read', workDay: { date: '2026-09-09', punches: ['08:32', '12:00', '13:29'] } },
  { status: 'read', workDay: { date: '2026-09-08', punches: ['08:32', '13:29', '13:30'] } },
  { status: 'read', workDay: { date: '2026-09-09', punches: ['13:30'] } },
])('only waits and then notifies when the observation cannot confirm a Punch: %j', (observation) => {
  const before = { date: '2026-09-09', punches: ['08:32', '13:29'] }
  const deadline = trigger.at + 60_000

  expect(decideConfirmation(before, observation, trigger.at, deadline, new Date(deadline - 1))).toEqual({ result: 'confirming' })
  expect(decideConfirmation(before, observation, trigger.at, deadline, new Date(deadline))).toEqual({
    result: 'unconfirmed',
    notification: 'Não foi possível confirmar a Marcação. O clique não será repetido. Confira a Jornada no PontoMais antes de marcar manualmente.',
  })
})

test('with zero deviation recognizes only the nominal minute', () => {
  const exact = { ...trigger, window: { start: trigger.at, end: trigger.at } }

  expect(decidePunch(exact, { date: '2026-09-09', punches: ['13:30'] }, now).result).toBe('already-filled')
  expect(decidePunch(exact, { date: '2026-09-09', punches: ['13:29'] }, now).result).toBe('click')
})
