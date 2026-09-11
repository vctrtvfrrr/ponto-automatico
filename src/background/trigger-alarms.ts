import { decideDelivery, describeAlert, PUSH_BACKOFF_MS } from '../alerts/alert.ts'
import { pushAlert } from '../alerts/ntfy.ts'
import { loadPushAllowedAt, savePushAllowedAt } from '../alerts/storage.ts'
import { loadAutomation } from '../automation/storage.ts'
import { loadSchedule } from '../schedule/storage.ts'
import { decideAttempt } from '../triggers/attempt.ts'
import type { DailyTriggers } from '../triggers/plan.ts'
import { interruptedAttempt } from '../triggers/punch.ts'
import type { StoredTrigger } from '../triggers/stored.ts'
import { closeAttemptTab, performPunch } from './page.ts'

const TRIGGER_PREFIX = 'trigger:'

export async function ensureTriggerAlarms(day: DailyTriggers): Promise<void> {
  const stored = await chrome.storage.local.get(null)
  const added: Record<string, StoredTrigger> = {}
  for (const trigger of day.triggers) {
    const name = `${TRIGGER_PREFIX}${day.date}:${trigger.slot}`
    if (stored[name] === undefined) added[name] = { date: day.date, trigger }
  }
  if (Object.keys(added).length > 0) await chrome.storage.local.set(added)

  for (const [name, record] of Object.entries({ ...stored, ...added })) {
    if (!name.startsWith(TRIGGER_PREFIX)) continue
    const saved = record as StoredTrigger
    if (saved.attempt) {
      await finishAttempt(name, saved)
    } else if (!await chrome.alarms.get(name)) {
      await chrome.alarms.create(name, { when: saved.trigger.at })
    }
  }
}

export async function handleTriggerAlarm(name: string): Promise<void> {
  if (!name.startsWith(TRIGGER_PREFIX)) return
  const stored = await chrome.storage.local.get(name)
  const saved = stored[name] as StoredTrigger | undefined
  if (!saved) return
  if (saved.attempt) {
    await finishAttempt(name, saved)
    return
  }

  const schedule = await loadSchedule()
  if (!Number.isInteger(schedule.toleranceMinutes) || schedule.toleranceMinutes < 0) {
    throw new Error('A tolerância da Escala é inválida.')
  }
  const automation = await loadAutomation()
  const now = new Date()
  const decision = decideAttempt(saved.trigger, schedule.toleranceMinutes, now, automation)
  if (decision.result === 'wait') {
    await chrome.alarms.create(name, { when: saved.trigger.at })
    return
  }

  const completed: StoredTrigger = { ...saved, attempt: { at: now.getTime(), decision } }
  if (decision.result === 'ready') {
    // A durable Attempt consumes the Trigger before any message can cause a click.
    completed.attempt = { at: now.getTime(), decision: interruptedAttempt(), tabIds: [] }
    await chrome.storage.local.set({ [name]: completed })
    completed.attempt.decision = await performPunch(saved.date, saved.trigger, schedule.toleranceMinutes, async (tabId) => {
      completed.attempt!.tabIds!.push(tabId)
      await chrome.storage.local.set({ [name]: completed })
    }, async (workDay) => {
      completed.attempt!.workDay = workDay
      await chrome.storage.local.set({ [name]: completed })
    }, async (registration) => {
      completed.attempt!.registration = registration
      await chrome.storage.local.set({ [name]: completed })
    })
  }
  await chrome.storage.local.set({ [name]: completed })
  await finishAttempt(name, completed)
}

async function finishAttempt(name: string, saved: StoredTrigger): Promise<void> {
  await chrome.alarms.clear(name)
  for (const tabId of saved.attempt!.tabIds ?? []) await closeAttemptTab(tabId)
  if (saved.attempt!.tabIds) {
    delete saved.attempt!.tabIds
    await chrome.storage.local.set({ [name]: saved })
  }
  const alert = describeAlert(saved.attempt!.decision, saved.date, saved.trigger.at)
  if (!alert) return
  const delivery = decideDelivery(saved, new Date(), await loadPushAllowedAt())

  // The channels run side by side: a slow push never delays the notification,
  // and a notification the browser refuses never takes the push down with it.
  const pushing = delivery.push ? pushAlert(alert, name) : undefined

  if (delivery.notify) {
    await chrome.notifications.create(name, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL(chrome.runtime.getManifest().icons!['128']!),
      title: alert.title,
      message: alert.message,
    })
    saved.notified = true
    await chrome.storage.local.set({ [name]: saved })
  }
  if (pushing) {
    if (await pushing) {
      saved.pushed = true
      await chrome.storage.local.set({ [name]: saved })
    } else {
      await savePushAllowedAt(Date.now() + PUSH_BACKOFF_MS)
    }
  }
}
