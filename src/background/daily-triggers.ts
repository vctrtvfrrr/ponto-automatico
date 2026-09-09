import { loadSchedule } from '../schedule/storage.ts'
import { planToday, type DailyTriggers } from '../triggers/plan.ts'

// Only this worker writes daily Triggers. The queue serializes read/draw/write;
// the day itself always comes from persistent storage, including after a wake.
let pending: Promise<void> = Promise.resolve()

export function getTodayTriggers(): Promise<DailyTriggers> {
  const result = pending.then(async () => {
    const schedule = await loadSchedule()
    const stored = await chrome.storage.local.get('dailyTriggers')
    const previous: unknown = stored.dailyTriggers
    if (previous !== undefined && !isDailyTriggers(previous)) {
      throw new Error('Os Gatilhos armazenados têm formato inválido.')
    }

    const day = planToday(schedule, previous, new Date(), Math.random)
    if (day !== previous) await chrome.storage.local.set({ dailyTriggers: day })
    return day
  })

  pending = result.then(() => {}, () => {})
  return result
}

function isDailyTriggers(value: unknown): value is DailyTriggers {
  if (typeof value !== 'object' || value === null) return false
  if (!('date' in value) || typeof value.date !== 'string') return false
  if (!('triggers' in value) || !Array.isArray(value.triggers)) return false

  return value.triggers.every((trigger: unknown, slot) => (
    typeof trigger === 'object' && trigger !== null &&
    'slot' in trigger && trigger.slot === slot &&
    'at' in trigger && typeof trigger.at === 'number' && Number.isFinite(trigger.at)
  ))
}
