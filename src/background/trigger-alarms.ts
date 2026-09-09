import { loadAutomation } from '../automation/storage.ts'
import { loadSchedule } from '../schedule/storage.ts'
import type { WorkDay } from '../page/readers.ts'
import { decideAttempt, type AttemptDecision } from '../triggers/attempt.ts'
import type { DailyTriggers, Trigger } from '../triggers/plan.ts'
import { interruptedAttempt, type PunchOutcome } from '../triggers/punch.ts'
import { closeAttemptTab, performPunch } from './page.ts'

const TRIGGER_PREFIX = 'trigger:'

type Attempt = { at: number; decision: Exclude<AttemptDecision, { result: 'wait' }> | PunchOutcome; tabIds?: number[]; workDay?: WorkDay }
type StoredTrigger = { date: string; trigger: Trigger; attempt?: Attempt; notified?: boolean }

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
  const decision = saved.attempt!.decision
  if (!('notification' in decision) || saved.notified) return

  await chrome.notifications.create(name, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(chrome.runtime.getManifest().icons!['128']!),
    title: decision.result === 'expired' ? 'Ponto Automático — Gatilho vencido' : 'Ponto Automático — Falha na Tentativa',
    message: `Gatilho de ${saved.date}, ${new Date(saved.trigger.at).toLocaleTimeString('pt-BR')}. ${decision.notification}`,
  })
  await chrome.storage.local.set({ [name]: { ...saved, notified: true } })
}
