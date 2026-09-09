import { loadSchedule } from '../schedule/storage.ts'
import { decideAttempt, type AttemptDecision } from '../triggers/attempt.ts'
import type { DailyTriggers, Trigger } from '../triggers/plan.ts'

const TRIGGER_PREFIX = 'trigger:'

type Attempt = { at: number; decision: Exclude<AttemptDecision, { result: 'wait' }> }
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
  const now = new Date()
  const decision = decideAttempt(saved.trigger, schedule.toleranceMinutes, now)
  if (decision.result === 'wait') {
    await chrome.alarms.create(name, { when: saved.trigger.at })
    return
  }

  // TODO: Continue ready Attempts through the page adapter in issues #8 and #9.
  const completed: StoredTrigger = { ...saved, attempt: { at: now.getTime(), decision } }
  await chrome.storage.local.set({ [name]: completed })
  await finishAttempt(name, completed)
}

async function finishAttempt(name: string, saved: StoredTrigger): Promise<void> {
  await chrome.alarms.clear(name)
  const decision = saved.attempt!.decision
  if (decision.result !== 'expired' || saved.notified) return

  await chrome.notifications.create(name, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(chrome.runtime.getManifest().icons!['128']!),
    title: 'Ponto Automático — Gatilho vencido',
    message: `Gatilho de ${saved.date}, ${new Date(saved.trigger.at).toLocaleTimeString('pt-BR')}. ${decision.notification}`,
  })
  await chrome.storage.local.set({ [name]: { ...saved, notified: true } })
}
