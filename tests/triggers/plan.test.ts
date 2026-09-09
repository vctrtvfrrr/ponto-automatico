import { expect, test } from 'vitest'
import { DEFAULT_SCHEDULE } from '../../src/schedule/storage.ts'
import type { Weekday } from '../../src/schedule/schedule.ts'
import { nextTrigger, planToday } from '../../src/triggers/plan.ts'

const wednesday = new Date(2026, 8, 9, 6)
const noTimes: Record<Weekday, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

test('does not plan or draw while automation is disabled, even with an existing plan', () => {
  const previous = { date: '2026-09-09', triggers: [{ slot: 0, at: wednesday.getTime() }] }

  for (const day of [undefined, previous]) {
    expect(planToday(DEFAULT_SCHEDULE, day, wednesday, () => {
      throw new Error('Disabled automation must not draw')
    }, false)).toBeUndefined()
  }
})

test('selects the next Trigger at or after the injected current instant', () => {
  const day = planToday(DEFAULT_SCHEDULE, undefined, wednesday, () => 0.5)!

  expect(nextTrigger(day, new Date(2026, 8, 9, 8, 30))).toEqual(day.triggers[0])
  expect(nextTrigger(day, new Date(2026, 8, 9, 8, 30, 1))).toEqual(day.triggers[1])
  expect(nextTrigger(day, new Date(2026, 8, 9, 18, 0, 1))).toBeUndefined()
  expect(nextTrigger({ date: day.date, triggers: [] }, wednesday)).toBeUndefined()
})

test('starts a new local day with new Triggers even when UTC is already on the following date', () => {
  const late = new Date(2026, 8, 9, 23, 59)
  const day = planToday(DEFAULT_SCHEDULE, undefined, late, () => 0)!
  const tomorrow = planToday(DEFAULT_SCHEDULE, day, new Date(2026, 8, 10, 0, 0), () => 1)!

  expect(day.date).toBe('2026-09-09')
  expect(tomorrow.date).toBe('2026-09-10')
  expect(tomorrow.triggers[0]).toEqual({ slot: 0, at: new Date(2026, 8, 10, 8, 45).getTime() })
})

test('persists a weekday without Schedule times as an empty day', () => {
  const saturday = new Date(2026, 8, 12, 6)
  const day = planToday(DEFAULT_SCHEDULE, undefined, saturday, () => {
    throw new Error('An empty weekday must not draw')
  })

  expect(day).toEqual({ date: '2026-09-12', triggers: [] })
  expect(planToday({ ...DEFAULT_SCHEDULE, times: { ...noTimes, 6: ['12:00'] } }, day, saturday, () => 0)).toEqual(day)
})

test('keeps strict slot order for every extreme combination at the narrowest allowed spacing', () => {
  const schedule = { ...DEFAULT_SCHEDULE, times: { ...noTimes, 3: ['08:30', '09:01', '09:32', '10:03'] } }

  for (let combination = 0; combination < 16; combination++) {
    const draws = [0, 1, 2, 3].map((slot) => (combination >> slot) & 1)
    const day = planToday(schedule, undefined, wednesday, () => draws.shift()!)!
    expect(day.triggers.map(({ slot }) => slot)).toEqual([0, 1, 2, 3])
    for (let slot = 1; slot < day.triggers.length; slot++) {
      expect(day.triggers[slot]!.at).toBeGreaterThan(day.triggers[slot - 1]!.at)
    }
  }
})

test.each([
  { draws: [1, 0, 1, 0], hours: 7 },
  { draws: [0.5, 0.5, 0.5, 0.5], hours: 8 },
  { draws: [0, 1, 0, 1], hours: 9 },
])('preserves ADR-0002: independent deviations allow a $hours-hour WorkDay', ({ draws, hours }) => {
  const samples = [...draws]
  const { triggers } = planToday(DEFAULT_SCHEDULE, undefined, wednesday, () => samples.shift()!)!
  const duration = triggers[1]!.at - triggers[0]!.at + triggers[3]!.at - triggers[2]!.at

  expect(duration / 3_600_000).toBe(hours)
})

test('rejects an invalid Schedule before drawing Triggers that could change slot order', () => {
  const schedule = { ...DEFAULT_SCHEDULE, times: { ...noTimes, 3: ['08:30', '09:00'] } }

  expect(() => planToday(schedule, undefined, wednesday, () => 0.5)).toThrow('A Escala contém valores inválidos.')
})

test.each([0, 1, 15, 719])('keeps every draw bucket inside deviation %i, including the upper endpoint', (deviationMinutes) => {
  const schedule = {
    ...DEFAULT_SCHEDULE,
    times: { ...noTimes, 3: ['12:00'] },
    deviationMinutes,
  }
  const nominal = new Date(2026, 8, 9, 12).getTime()
  const offsets = new Set<number>()
  const bucketCount = 2 * deviationMinutes + 1

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    for (const position of [0.25, 0.75]) {
      const day = planToday(schedule, undefined, wednesday, () => (bucket + position) / bucketCount)!
      const offset = (day.triggers[0]!.at - nominal) / 60_000
      expect(Number.isInteger(offset)).toBe(true)
      expect(offset).toBeGreaterThanOrEqual(-deviationMinutes)
      expect(offset).toBeLessThanOrEqual(deviationMinutes)
      offsets.add(offset)
    }
  }

  expect(offsets.size).toBe(bucketCount)
  for (const draw of [0, Number.MIN_VALUE, 1 - Number.EPSILON, 1]) {
    const day = planToday(schedule, undefined, wednesday, () => draw)!
    expect(day.triggers[0]!.at).toBeGreaterThanOrEqual(nominal - deviationMinutes * 60_000)
    expect(day.triggers[0]!.at).toBeLessThanOrEqual(nominal + deviationMinutes * 60_000)
  }
})

test('persists an empty day on a SkipDate without using randomness', () => {
  const schedule = { ...DEFAULT_SCHEDULE, skipDates: ['2026-09-09'] }
  const day = planToday(schedule, undefined, wednesday, () => {
    throw new Error('A SkipDate must not draw')
  })

  expect(day).toEqual({ date: '2026-09-09', triggers: [] })
  expect(planToday(DEFAULT_SCHEDULE, day, wednesday, () => 0)).toEqual(day)
})

test('keeps persisted Triggers for the same local date even after editing the Schedule', () => {
  const previous = planToday(DEFAULT_SCHEDULE, undefined, wednesday, () => 0)
  const changed = { ...DEFAULT_SCHEDULE, deviationMinutes: 0, skipDates: ['2026-09-09'] }
  const later = new Date(2026, 8, 9, 23, 59)

  expect(planToday(changed, JSON.parse(JSON.stringify(previous)), later, () => {
    throw new Error('A persisted day must not draw again')
  })).toEqual(previous)
})

test('draws one Trigger per Schedule time using independent whole-minute deviations', () => {
  const draws = [0, 0.5, 1 - Number.EPSILON, 0.25]
  const day = planToday(DEFAULT_SCHEDULE, undefined, wednesday, () => draws.shift()!)!

  expect(day).toEqual({
    date: '2026-09-09',
    triggers: [
      { slot: 0, at: new Date(2026, 8, 9, 8, 15).getTime() },
      { slot: 1, at: new Date(2026, 8, 9, 12, 0).getTime() },
      { slot: 2, at: new Date(2026, 8, 9, 13, 45).getTime() },
      { slot: 3, at: new Date(2026, 8, 9, 17, 52).getTime() },
    ],
  })
})
