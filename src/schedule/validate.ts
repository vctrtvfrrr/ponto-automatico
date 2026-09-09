import { WEEKDAYS, type Schedule, type ScheduleError, type Weekday } from './schedule.ts'

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MINUTES_IN_DAY = 24 * 60

export function validateSchedule(schedule: Schedule): ScheduleError[] {
  const errors: ScheduleError[] = []

  if (!isWholeMinuteCount(schedule.deviationMinutes)) errors.push({ kind: 'invalid-deviation' })
  if (!isWholeMinuteCount(schedule.toleranceMinutes)) errors.push({ kind: 'invalid-tolerance' })

  // A broken deviation makes its own consequences unjudgeable, so the overlap
  // and midnight checks stand down until it is fixed.
  const deviationMinutes = isWholeMinuteCount(schedule.deviationMinutes)
    ? schedule.deviationMinutes
    : null

  for (const weekday of WEEKDAYS) {
    errors.push(...validateDay(weekday, schedule.times[weekday], deviationMinutes))
  }

  for (const value of schedule.skipDates) {
    if (!isCalendarDate(value)) errors.push({ kind: 'malformed-skip-date', value })
  }

  return errors
}

function validateDay(
  weekday: Weekday,
  times: string[],
  deviationMinutes: number | null,
): ScheduleError[] {
  const errors: ScheduleError[] = []
  const parsed: { value: string; at: number }[] = []

  for (const value of times) {
    const at = parseTimeOfDay(value)
    if (at === null) errors.push({ kind: 'malformed-time', weekday, value })
    else parsed.push({ value, at })
  }

  if (deviationMinutes !== null) {
    for (const { value, at } of parsed) {
      if (at - deviationMinutes < 0 || at + deviationMinutes >= MINUTES_IN_DAY) {
        errors.push({ kind: 'deviation-crosses-midnight', weekday, time: value, deviationMinutes })
      }
    }
  }

  // Order and spacing are pairwise, so one unreadable value makes the whole
  // sequence unjudgeable. Each time's own distance from midnight is not.
  if (parsed.length < times.length) return errors

  for (const [index, current] of parsed.entries()) {
    const previous = parsed[index - 1]
    if (previous === undefined) continue

    if (current.at <= previous.at) {
      errors.push({
        kind: 'times-out-of-order',
        weekday,
        first: previous.value,
        second: current.value,
      })
      continue
    }

    if (deviationMinutes !== null && current.at - previous.at <= 2 * deviationMinutes) {
      errors.push({
        kind: 'deviation-overlaps-times',
        weekday,
        first: previous.value,
        second: current.value,
        deviationMinutes,
      })
    }
  }

  return errors
}

function parseTimeOfDay(value: string): number | null {
  const match = TIME_OF_DAY.exec(value)
  if (match === null) return null

  return Number(match[1]) * 60 + Number(match[2])
}

function isCalendarDate(value: string): boolean {
  const match = CALENDAR_DATE.exec(value)
  if (match === null) return false

  const [, year, month, day] = match
  // Date rolls out-of-range parts over into the next month or year, so a date
  // that survives the round trip unchanged is one the calendar really has.
  const rolled = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  return (
    rolled.getUTCFullYear() === Number(year) &&
    rolled.getUTCMonth() === Number(month) - 1 &&
    rolled.getUTCDate() === Number(day)
  )
}

function isWholeMinuteCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0
}
