import { expect, test } from 'vitest'
import { buildTimeline, punchInstants, type TimelineInput } from '../../src/popup/timeline.ts'

const date = '2026-09-09'
const at = (hours: number, minutes: number) => new Date(2026, 8, 9, hours, minutes).getTime()

function trigger(slot: number, hours: number, minutes: number) {
  return { slot, at: at(hours, minutes), window: { start: at(hours, minutes - 15), end: at(hours, minutes + 15) } }
}

function timeline(input: Partial<TimelineInput>) {
  const now = input.now ?? at(12, 0)
  return buildTimeline({ triggers: [], punches: [], toleranceMinutes: 15, now, observedAt: now, ...input })
}

test('reads every Punch of the WorkDay as an instant on its own date', () => {
  expect(punchInstants({ date, punches: ['08:27', '12:03'] })).toEqual([at(8, 27), at(12, 3)])
})

test('recognizes a Punch created after the window ends but inside the Tolerance', () => {
  const late = trigger(0, 8, 45)

  expect(timeline({ triggers: [late], punches: [at(8, 52)], now: at(9, 30) })).toEqual([
    { at: at(8, 52), state: 'fulfilled' },
  ])
})

test('recognizes a Punch created before the drawn instant, from the window start on', () => {
  expect(timeline({ triggers: [trigger(0, 8, 45)], punches: [at(8, 30)], now: at(9, 30) })).toEqual([
    { at: at(8, 30), state: 'fulfilled' },
  ])
  expect(timeline({ triggers: [trigger(0, 8, 45)], punches: [at(8, 29)], now: at(9, 30) })).toEqual([
    { at: at(8, 29), state: 'unplanned' },
    { at: at(8, 45), state: 'failed' },
  ])
})

test('lets no Punch be claimed by two Triggers when the Tolerance makes the ranges overlap', () => {
  const triggers = [
    { slot: 0, at: at(12, 0), window: { start: at(11, 55), end: at(12, 5) } },
    { slot: 1, at: at(12, 20), window: { start: at(12, 15), end: at(12, 25) } },
  ]

  expect(timeline({ triggers, punches: [at(12, 15)], now: at(13, 0) })).toEqual([
    { at: at(12, 15), state: 'fulfilled' },
    { at: at(12, 20), state: 'failed' },
  ])
})

test('leaves a Trigger without a usable window neutral instead of inventing a state', () => {
  const withoutWindow = { slot: 0, at: at(8, 45) }
  const outsideWindow = { slot: 1, at: at(12, 0), window: { start: at(13, 0), end: at(13, 30) } }

  expect(timeline({ triggers: [withoutWindow, outsideWindow], punches: [at(8, 45)], now: at(14, 0) })).toEqual([
    { at: at(8, 45), state: 'unreconciled' },
    { at: at(8, 45), state: 'unplanned' },
    { at: at(12, 0), state: 'unreconciled' },
  ])
})

test('keeps a Trigger fulfilled even when it precedes the Automation resume', () => {
  const triggers = [trigger(0, 8, 45), trigger(1, 9, 30)]

  expect(timeline({ triggers, punches: [at(8, 44)], now: at(13, 0), resumedAt: at(10, 0) })).toEqual([
    { at: at(8, 44), state: 'fulfilled' },
    { at: at(9, 30), state: 'disabled' },
  ])
})

test('places an unclaimed Punch in its chronological position, labelled', () => {
  const triggers = [trigger(0, 8, 45), trigger(1, 18, 0)]

  expect(timeline({ triggers, punches: [at(8, 44), at(12, 0)], now: at(13, 0) })).toEqual([
    { at: at(8, 44), state: 'fulfilled' },
    { at: at(12, 0), state: 'unplanned' },
    { at: at(18, 0), state: 'next' },
  ])
})

test('leaves Punches neutral when no Trigger exists to be missing', () => {
  expect(timeline({ punches: [at(8, 44), at(12, 0)], now: at(13, 0) })).toEqual([
    { at: at(8, 44), state: 'unreconciled' },
    { at: at(12, 0), state: 'unreconciled' },
  ])
})

test('ranks the states of an unfulfilled Trigger by when it stands in the day', () => {
  const triggers = [trigger(0, 8, 30), trigger(1, 11, 50), trigger(2, 13, 30), trigger(3, 18, 0)]

  expect(timeline({ triggers, now: at(12, 0) })).toEqual([
    { at: at(8, 30), state: 'failed' },
    { at: at(11, 50), state: 'awaiting' },
    { at: at(13, 30), state: 'next' },
    { at: at(18, 0), state: 'future' },
  ])
})

test('holds a Trigger awaiting up to the last instant of the Tolerance', () => {
  const triggers = [trigger(0, 11, 45)]

  expect(timeline({ triggers, now: at(12, 0) })[0]).toEqual({ at: at(11, 45), state: 'awaiting' })
  expect(timeline({ triggers, now: at(12, 0) + 1 })[0]).toEqual({ at: at(11, 45), state: 'failed' })
})

test('claims no failure it has no reading of the Jornada to back', () => {
  const triggers = [trigger(0, 8, 30), trigger(1, 11, 50)]

  expect(buildTimeline({ triggers, punches: [], toleranceMinutes: 15, now: at(12, 0) })).toEqual([
    { at: at(8, 30), state: 'unverified' },
    { at: at(11, 50), state: 'unverified' },
  ])
})

test('waits for a reading taken after the Tolerance before calling a Trigger failed', () => {
  const triggers = [trigger(0, 11, 30)]

  expect(timeline({ triggers, now: at(12, 0), observedAt: at(11, 45) })[0]).toEqual({
    at: at(11, 30), state: 'unverified',
  })
  expect(timeline({ triggers, now: at(12, 0), observedAt: at(11, 46) })[0]).toEqual({
    at: at(11, 30), state: 'failed',
  })
})

test('waits for a reading taken after the Trigger before calling it awaiting', () => {
  const triggers = [trigger(0, 11, 50)]

  expect(timeline({ triggers, now: at(12, 0), observedAt: at(11, 49) })[0]).toEqual({
    at: at(11, 50), state: 'unverified',
  })
  expect(timeline({ triggers, now: at(12, 0), observedAt: at(11, 50) })[0]).toEqual({
    at: at(11, 50), state: 'awaiting',
  })
})
