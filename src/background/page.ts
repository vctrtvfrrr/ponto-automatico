import { CLICK_PUNCH, READ_REGISTRATION, READ_WORK_DAY, type ClickPunchMessage, type ClickPunchResponse, type ReadWorkDayMessage, type WorkDaySnapshot } from '../page/messages.ts'
import { decidePageObservation, decideRegistration, type PageObservation, type RegistrationObservation } from '../page/observation.ts'
import type { WorkDay } from '../page/readers.ts'
import type { Trigger } from '../triggers/plan.ts'
import { decideConfirmation, decidePunch, interruptedAttempt, type PunchOutcome } from '../triggers/punch.ts'

const PAGE_TIMEOUT_MS = 45_000
const POLL_INTERVAL_MS = 500
const CONFIRMATION_TIMEOUT_MS = 60_000

export async function observeWorkDay(
  date: string,
  deadline = Date.now() + PAGE_TIMEOUT_MS,
  trackTab?: (tabId: number) => Promise<void>,
): Promise<PageObservation & { observedAt: number }> {
  let tabId: number | undefined
  try {
    const tab = await chrome.tabs.create({ url: 'https://app2.pontomais.com.br/meu-ponto', active: false })
    tabId = tab.id!
    await trackTab?.(tabId)
    const observation = await withinDeadline(waitForWorkDay(tabId, date, deadline), deadline, { status: 'unreadable' } as PageObservation)
    const observedAt = Date.now()
    if (observation.status === 'read') {
      await chrome.storage.local.set({ latestWorkDay: { workDay: observation.workDay, observedAt } satisfies WorkDaySnapshot })
    }
    return { ...observation, observedAt }
  } catch {
    return { status: 'unreadable', observedAt: Date.now() }
  } finally {
    if (tabId !== undefined) await closeAttemptTab(tabId)
  }
}

export async function performPunch(
  date: string,
  trigger: Trigger,
  toleranceMinutes: number,
  trackTab: (tabId: number) => Promise<void>,
  recordWorkDay: (workDay: WorkDay) => Promise<void>,
): Promise<PunchOutcome> {
  let tabId: number | undefined
  try {
    const tab = await chrome.tabs.create({ url: 'https://app2.pontomais.com.br/registrar-ponto', active: false })
    tabId = tab.id!
    await trackTab(tabId)
    const registrationDeadline = Date.now() + PAGE_TIMEOUT_MS
    const registration = await withinDeadline(waitForRegistration(tabId, registrationDeadline), registrationDeadline, 'missing')
    const observation = await observeWorkDay(date, Date.now() + PAGE_TIMEOUT_MS, trackTab)
    const page = decidePageObservation(observation)
    if (page.result !== 'read') return page
    await recordWorkDay(page.workDay)
    const decision = decidePunch(trigger, page.workDay, new Date())
    if (decision.result !== 'click') return decision
    const button = decideRegistration(registration)
    if (button.result !== 'ready') return button

    let clickedAt = Date.now()
    const response = await withinDeadline<ClickPunchResponse>(chrome.tabs.sendMessage(tabId, {
      type: CLICK_PUNCH, trigger, toleranceMinutes, workDay: page.workDay, observedAt: observation.observedAt,
    } satisfies ClickPunchMessage, { frameId: 0 }).catch(() => interruptedAttempt()), clickedAt + 2_000, interruptedAttempt())
    if (response.result === 'clicked') clickedAt = response.at
    else if (response.result !== 'interrupted') return response

    const deadline = clickedAt + CONFIRMATION_TIMEOUT_MS
    while (true) {
      const after = await observeWorkDay(date, Math.min(deadline, Date.now() + PAGE_TIMEOUT_MS), trackTab)
      if (after.status === 'read') await recordWorkDay(after.workDay)
      const confirmation = decideConfirmation(page.workDay, after, clickedAt, deadline, new Date())
      if (confirmation.result !== 'confirming') return confirmation
      await new Promise((resolve) => setTimeout(resolve, Math.min(2_000, Math.max(0, deadline - Date.now()))))
    }
  } catch {
    return interruptedAttempt()
  } finally {
    if (tabId !== undefined) await closeAttemptTab(tabId)
  }
}

export async function closeAttemptTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.url?.startsWith('https://app2.pontomais.com.br/')) await chrome.tabs.remove(tabId)
  } catch {
    // The user may have already closed the Attempt's tab.
  }
}

async function withinDeadline<T>(operation: Promise<T>, deadline: number, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => { timeout = setTimeout(() => resolve(fallback), Math.max(0, deadline - Date.now())) }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForRegistration(tabId: number, deadline: number): Promise<RegistrationObservation> {
  while (Date.now() < deadline) {
    await chrome.tabs.get(tabId)
    try {
      const observation: RegistrationObservation = await chrome.tabs.sendMessage(tabId, { type: READ_REGISTRATION }, { frameId: 0 })
      if (observation === 'ready' || observation === 'disabled' || observation === 'login') return observation
    } catch {
      // Navigation can replace the document before its content script responds.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return 'missing'
}

async function waitForWorkDay(tabId: number, date: string, deadline: number): Promise<PageObservation> {
  while (Date.now() < deadline) {
    await chrome.tabs.get(tabId)
    try {
      const observation: PageObservation = await chrome.tabs.sendMessage(tabId, {
        type: READ_WORK_DAY, date,
      } satisfies ReadWorkDayMessage, { frameId: 0 })
      if (Date.now() < deadline && (observation?.status === 'read' || observation?.status === 'login')) return observation
    } catch {
      // Navigation can replace the document before its content script responds.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return { status: 'unreadable' }
}
