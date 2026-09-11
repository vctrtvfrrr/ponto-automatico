import type { Schedule, Weekday } from '../schedule/schedule.ts'
import { validateSchedule } from '../schedule/validate.ts'

export type Trigger = { slot: number; at: number; window?: { start: number; end: number } }
export type DailyTriggers = { date: string; triggers: Trigger[] }

export function planToday(
  schedule: Schedule,
  previous: DailyTriggers | undefined,
  now: Date,
  random: () => number,
  automationEnabled = true,
): DailyTriggers | undefined {
  if (!automationEnabled) return undefined
  const date = localDate(now)
  if (previous?.date === date) return previous
  if (validateSchedule(schedule).length > 0) throw new Error('A Escala contém valores inválidos.')
  if (schedule.skipDates.includes(date)) return { date, triggers: [] }

  const deviation = schedule.deviationMinutes
  const triggers = schedule.times[now.getDay() as Weekday].map((time, slot) => {
    const [hours, minutes] = time.split(':').map(Number)
    const offset = Math.min(2 * deviation, Math.floor(random() * (2 * deviation + 1))) - deviation
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours!, minutes! + offset)
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours!, minutes! - deviation)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours!, minutes! + deviation)
    return { slot, at: at.getTime(), window: { start: start.getTime(), end: end.getTime() } }
  })

  return { date, triggers }
}

export function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// A Trigger drawn by an older version has no window, and one drawn around a
// changed Schedule may hold `at` outside it. Neither can be reconciled.
export function recognitionWindow(trigger: Trigger): { start: number; end: number } | undefined {
  const window = trigger.window
  if (!window || !Number.isFinite(window.start) || !Number.isFinite(window.end)) return undefined
  return window.start <= trigger.at && trigger.at <= window.end ? window : undefined
}

export function nextTrigger(day: DailyTriggers, now: Date): Trigger | undefined {
  return day.triggers.find(({ at }) => at >= now.getTime())
}
