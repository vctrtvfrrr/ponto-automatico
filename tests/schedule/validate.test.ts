import { describe, expect, test } from 'vitest'
import type { Schedule, Weekday } from '../../src/schedule/schedule.ts'
import { validateSchedule } from '../../src/schedule/validate.ts'

const NO_TIMES: Record<Weekday, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

function schedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    times: NO_TIMES,
    deviationMinutes: 15,
    toleranceMinutes: 15,
    skipDates: [],
    ...overrides,
  }
}

function onWednesday(times: string[], overrides: Partial<Schedule> = {}): Schedule {
  return schedule({ times: { ...NO_TIMES, 3: times }, ...overrides })
}

test('accepts the reference workweek: 08:30, 12:00, 13:30, 18:00 with deviation 15', () => {
  const workday = ['08:30', '12:00', '13:30', '18:00']

  expect(
    validateSchedule(
      schedule({
        times: { ...NO_TIMES, 1: workday, 2: workday, 3: workday, 4: workday, 5: workday },
        deviationMinutes: 15,
        toleranceMinutes: 15,
        skipDates: ['2026-12-25'],
      }),
    ),
  ).toEqual([])
})

test('treats a weekday with no times as a non-working day, not an error', () => {
  expect(validateSchedule(schedule())).toEqual([])
})

describe('malformed time', () => {
  test.each(['8:30', '08h30', '24:00', '12:60', '', 'meio-dia'])('rejects %j', (value) => {
    expect(validateSchedule(onWednesday([value]))).toEqual([
      { kind: 'malformed-time', weekday: 3, value },
    ])
  })

  test('does not judge ordering while a value is unreadable', () => {
    const errors = validateSchedule(onWednesday(['18:00', 'meio-dia', '08:30']))

    expect(errors).toEqual([{ kind: 'malformed-time', weekday: 3, value: 'meio-dia' }])
  })

  test('still judges each readable time against midnight, which is not a pairwise check', () => {
    expect(validateSchedule(onWednesday(['23:50', 'meio-dia']))).toEqual([
      { kind: 'malformed-time', weekday: 3, value: 'meio-dia' },
      { kind: 'deviation-crosses-midnight', weekday: 3, time: '23:50', deviationMinutes: 15 },
    ])
  })
})

describe('times out of increasing order', () => {
  test('rejects a time earlier than the one before it', () => {
    expect(validateSchedule(onWednesday(['12:00', '08:30']))).toEqual([
      { kind: 'times-out-of-order', weekday: 3, first: '12:00', second: '08:30' },
    ])
  })

  test('rejects the same time twice, which is not increasing either', () => {
    expect(validateSchedule(onWednesday(['12:00', '12:00']))).toEqual([
      { kind: 'times-out-of-order', weekday: 3, first: '12:00', second: '12:00' },
    ])
  })

  test('judges each day on its own, so a later day may start earlier', () => {
    expect(
      validateSchedule(schedule({ times: { ...NO_TIMES, 3: ['18:00'], 4: ['08:30'] } })),
    ).toEqual([])
  })
})

describe('deviation wide enough to overlap two neighbouring times', () => {
  test('rejects a gap narrower than the two draw ranges together', () => {
    expect(validateSchedule(onWednesday(['08:30', '08:50'], { deviationMinutes: 15 }))).toEqual([
      {
        kind: 'deviation-overlaps-times',
        weekday: 3,
        first: '08:30',
        second: '08:50',
        deviationMinutes: 15,
      },
    ])
  })

  test('rejects a gap of exactly twice the deviation, where both draws can land on the same instant', () => {
    expect(validateSchedule(onWednesday(['08:30', '09:00'], { deviationMinutes: 15 }))).toEqual([
      {
        kind: 'deviation-overlaps-times',
        weekday: 3,
        first: '08:30',
        second: '09:00',
        deviationMinutes: 15,
      },
    ])
  })

  test('accepts a gap one minute wider than that', () => {
    expect(validateSchedule(onWednesday(['08:30', '09:01'], { deviationMinutes: 15 }))).toEqual([])
  })

  test('accepts any gap when the deviation is zero', () => {
    expect(validateSchedule(onWednesday(['08:30', '08:31'], { deviationMinutes: 0 }))).toEqual([])
  })
})

describe('deviation reaching across midnight', () => {
  test('rejects a time whose draw can fall before 00:00', () => {
    expect(validateSchedule(onWednesday(['00:10'], { deviationMinutes: 15 }))).toEqual([
      { kind: 'deviation-crosses-midnight', weekday: 3, time: '00:10', deviationMinutes: 15 },
    ])
  })

  test('rejects a time whose draw can reach 24:00', () => {
    expect(validateSchedule(onWednesday(['23:50'], { deviationMinutes: 15 }))).toEqual([
      { kind: 'deviation-crosses-midnight', weekday: 3, time: '23:50', deviationMinutes: 15 },
    ])
  })

  test('accepts a draw range that stops exactly at the edges of the day', () => {
    expect(validateSchedule(onWednesday(['00:15'], { deviationMinutes: 15 }))).toEqual([])
    expect(validateSchedule(onWednesday(['23:44'], { deviationMinutes: 15 }))).toEqual([])
  })
})

describe('deviation and tolerance as whole minute counts', () => {
  test.each([-1, Number.NaN, 7.5])('rejects a deviation of %j', (deviationMinutes) => {
    expect(validateSchedule(schedule({ deviationMinutes }))).toEqual([{ kind: 'invalid-deviation' }])
  })

  test.each([-1, Number.NaN, 7.5])('rejects a tolerance of %j', (toleranceMinutes) => {
    expect(validateSchedule(schedule({ toleranceMinutes }))).toEqual([{ kind: 'invalid-tolerance' }])
  })

  test('accepts zero for both', () => {
    expect(
      validateSchedule(schedule({ deviationMinutes: 0, toleranceMinutes: 0 })),
    ).toEqual([])
  })

  test('does not judge overlap or midnight while the deviation itself is broken', () => {
    expect(validateSchedule(onWednesday(['23:50', '23:55'], { deviationMinutes: -1 }))).toEqual([
      { kind: 'invalid-deviation' },
    ])
  })
})

describe('skip date that is not a real date', () => {
  test.each(['25/12/2026', '2026-12-25T00:00:00', '2026-2-5', '', 'natal'])(
    'rejects the malformed %j',
    (value) => {
      expect(validateSchedule(schedule({ skipDates: [value] }))).toEqual([
        { kind: 'malformed-skip-date', value },
      ])
    },
  )

  test.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2027-02-29'])(
    'rejects the well-formed but non-existent %j',
    (value) => {
      expect(validateSchedule(schedule({ skipDates: [value] }))).toEqual([
        { kind: 'malformed-skip-date', value },
      ])
    },
  )

  test('accepts a leap day that exists', () => {
    expect(validateSchedule(schedule({ skipDates: ['2028-02-29'] }))).toEqual([])
  })
})

test('reports every problem at once, so one save shows the whole list', () => {
  const errors = validateSchedule(
    onWednesday(['08:30', '09:00'], { toleranceMinutes: -1, skipDates: ['natal'] }),
  )

  expect(errors.map((error) => error.kind)).toEqual([
    'invalid-tolerance',
    'deviation-overlaps-times',
    'malformed-skip-date',
  ])
})
