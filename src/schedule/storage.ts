import type { Schedule, Weekday } from './schedule.ts'

const STORAGE_KEY = 'schedule'

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
  const stored = await chrome.storage.local.get(STORAGE_KEY)

  return (stored[STORAGE_KEY] as Schedule | undefined) ?? DEFAULT_SCHEDULE
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: schedule })
}
