import { READ_WORK_DAY, type ReadWorkDayMessage } from '../page/messages.ts'
import type { PageObservation } from '../page/observation.ts'

const PAGE_TIMEOUT_MS = 45_000
const POLL_INTERVAL_MS = 500

export async function observeWorkDay(date: string): Promise<PageObservation> {
  let tabId: number | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const tab = await chrome.tabs.create({ url: 'https://app2.pontomais.com.br/meu-ponto', active: false })
    tabId = tab.id!
    const deadline = Date.now() + PAGE_TIMEOUT_MS
    return await Promise.race([
      waitForWorkDay(tabId, date, deadline),
      new Promise<PageObservation>((resolve) => {
        timeout = setTimeout(() => resolve({ status: 'unreadable' }), PAGE_TIMEOUT_MS)
      }),
    ])
  } catch {
    return { status: 'unreadable' }
  } finally {
    clearTimeout(timeout)
    if (tabId !== undefined) {
      try {
        await chrome.tabs.remove(tabId)
      } catch {
        // The user may have already closed the Attempt's tab.
      }
    }
  }
}

async function waitForWorkDay(tabId: number, date: string, deadline: number): Promise<PageObservation> {
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId)
    if (tab.status === 'complete') {
      try {
        const observation: PageObservation = await chrome.tabs.sendMessage(tabId, {
          type: READ_WORK_DAY, date,
        } satisfies ReadWorkDayMessage, { frameId: 0 })
        if (Date.now() < deadline && (observation?.status === 'read' || observation?.status === 'login')) return observation
      } catch {
        // Navigation can replace the document before its content script responds.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return { status: 'unreadable' }
}
