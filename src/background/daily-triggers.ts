import { loadSchedule } from '../schedule/storage.ts'
import { planToday, type DailyTriggers } from '../triggers/plan.ts'
import { ensureTriggerAlarms, handleTriggerAlarm } from './trigger-alarms.ts'

const NEXT_DAY_ALARM = 'plan-next-day'

// Serializing planning and Attempts prevents duplicate draws and lost writes.
// The queue holds no decision state; each operation reloads persistent storage.
let pending: Promise<void> = Promise.resolve()

export function getTodayTriggers(): Promise<DailyTriggers> {
  return enqueue(async () => {
    const schedule = await loadSchedule()
    const stored = await chrome.storage.local.get('dailyTriggers')
    const previous: unknown = stored.dailyTriggers
    if (previous !== undefined && !isDailyTriggers(previous)) {
      throw new Error('Os Gatilhos armazenados têm formato inválido.')
    }

    const day = planToday(schedule, previous, new Date(), Math.random)
    if (previous && day !== previous) await ensureTriggerAlarms(previous)
    if (day !== previous) await chrome.storage.local.set({ dailyTriggers: day })
    await ensureTriggerAlarms(day)

    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    await chrome.alarms.create(NEXT_DAY_ALARM, { when: midnight.getTime() })
    return day
  })
}

export function handleAlarm(name: string): Promise<unknown> {
  if (name === NEXT_DAY_ALARM) return getTodayTriggers()
  return enqueue(() => handleTriggerAlarm(name))
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation)
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
