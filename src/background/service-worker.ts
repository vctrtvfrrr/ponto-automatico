import { GET_TODAY_TRIGGERS, type TodayTriggersResponse } from '../triggers/messages.ts'
import { getTodayTriggers, handleAlarm } from './daily-triggers.ts'

// Listeners must be registered during the initial synchronous evaluation of this
// script. The worker is torn down after 30 s idle, and Chrome only delivers an
// event to a listener that the freshly woken script has already registered.
chrome.runtime.onInstalled.addListener(handleWake)
chrome.runtime.onStartup.addListener(handleWake)
chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm.name).catch((error: unknown) => console.error('Não foi possível processar o Gatilho.', error))
})
chrome.runtime.onMessage.addListener((message, _sender, sendResponse: (response: TodayTriggersResponse) => void) => {
  if (message?.type !== GET_TODAY_TRIGGERS) return

  void getTodayTriggers().then(
    (day) => sendResponse({ day }),
    (error: unknown) => sendResponse({ error: error instanceof Error ? error.message : 'Não foi possível carregar os Gatilhos.' }),
  )
  return true
})

handleWake()

function handleWake(): void {
  void getTodayTriggers().catch((error: unknown) => console.error('Não foi possível planejar os Gatilhos de hoje.', error))
}
