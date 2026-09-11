import { WEEKDAYS, type Schedule, type Weekday } from './schedule.ts'

export const SCHEDULE_KEY = 'schedule'

const REFERENCE_WORKDAY = ['08:30', '12:00', '13:30', '18:00']

const NO_TIMES: Record<Weekday, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

export const DEFAULT_SCHEDULE: Schedule = {
  times: {
    ...NO_TIMES,
    1: REFERENCE_WORKDAY,
    2: REFERENCE_WORKDAY,
    3: REFERENCE_WORKDAY,
    4: REFERENCE_WORKDAY,
    5: REFERENCE_WORKDAY,
  },
  deviationMinutes: 15,
  toleranceMinutes: 15,
  skipDates: [],
}

// `local`, never `session`: a Schedule has to survive a browser restart.
export async function loadSchedule(): Promise<Schedule> {
  const stored = await chrome.storage.local.get(SCHEDULE_KEY)
  const schedule: unknown = stored[SCHEDULE_KEY]

  if (schedule === undefined) return DEFAULT_SCHEDULE
  if (!isSchedule(schedule)) throw new Error('A Escala armazenada tem formato inválido.')

  return schedule
}

function isSchedule(value: unknown): value is Schedule {
  if (!isRecord(value)) return false
  const { times, deviationMinutes, toleranceMinutes, skipDates } = value

  return (
    isRecord(times) &&
    WEEKDAYS.every((weekday) => isStringArray(times[weekday])) &&
    typeof deviationMinutes === 'number' &&
    typeof toleranceMinutes === 'number' &&
    isStringArray(skipDates)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}
