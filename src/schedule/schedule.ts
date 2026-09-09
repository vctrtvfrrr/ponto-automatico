export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/**
 * Holds times and dates exactly as the user typed them. Only `validateSchedule`
 * proves them well-formed; no other reader may assume it.
 */
export type Schedule = {
  times: Record<Weekday, string[]>
  deviationMinutes: number
  toleranceMinutes: number
  skipDates: string[]
}

export type ScheduleError =
  | { kind: 'malformed-time'; weekday: Weekday; value: string }
  | { kind: 'times-out-of-order'; weekday: Weekday; first: string; second: string }
  | {
      kind: 'deviation-overlaps-times'
      weekday: Weekday
      first: string
      second: string
      deviationMinutes: number
    }
  | { kind: 'deviation-crosses-midnight'; weekday: Weekday; time: string; deviationMinutes: number }
  | { kind: 'invalid-deviation' }
  | { kind: 'invalid-tolerance' }
  | { kind: 'malformed-skip-date'; value: string }
