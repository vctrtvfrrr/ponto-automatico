import { loadAutomation } from '../automation/storage.ts'
import { decideAttempt } from '../triggers/attempt.ts'
import { decidePunch, interruptedAttempt } from '../triggers/punch.ts'
import { CLICK_PUNCH, READ_REGISTRATION, READ_WORK_DAY, type ClickPunchMessage, type ClickPunchResponse, type PageMessage } from './messages.ts'
import { decideRegistration, type PageObservation, type RegistrationObservation } from './observation.ts'
import { findPunchButton, isLoginPage, readWorkDay } from './readers.ts'

let clickConsumed = false

chrome.runtime.onMessage.addListener((message: PageMessage, _sender, sendResponse: (response: PageObservation | RegistrationObservation | ClickPunchResponse) => void) => {
  if (message?.type === READ_REGISTRATION) {
    sendResponse(readRegistration())
    return
  }
  if (message?.type === CLICK_PUNCH) {
    if (clickConsumed) {
      sendResponse(interruptedAttempt())
      return
    }
    clickConsumed = true
    void clickPunch(message).then(sendResponse, () => sendResponse(interruptedAttempt()))
    return true
  }
  if (message?.type !== READ_WORK_DAY || typeof message.date !== 'string') return
  if (isLoginPage(document)) {
    sendResponse({ status: 'login' })
    return
  }
  const workDay = location.pathname === '/meu-ponto' ? readWorkDay(document, message.date, new Date()) : undefined
  sendResponse(workDay ? { status: 'read', workDay } : { status: 'unreadable' })
})

function readRegistration(): RegistrationObservation {
  if (isLoginPage(document)) return 'login'
  if (location.pathname !== '/registrar-ponto') return 'missing'
  const button = findPunchButton(document)
  if (!button || button.getClientRects().length === 0 || getComputedStyle(button).visibility === 'hidden') return 'missing'
  return button.matches(':disabled') || button.closest('[aria-disabled="true"]') ? 'disabled' : 'ready'
}

async function clickPunch(message: ClickPunchMessage): Promise<ClickPunchResponse> {
  const automation = await loadAutomation()
  const now = new Date()
  const attempt = decideAttempt(message.trigger, message.toleranceMinutes, now, automation)
  if (attempt.result !== 'ready' && attempt.result !== 'wait') return attempt
  if (attempt.result === 'wait' || now.getTime() < message.observedAt || now.getTime() - message.observedAt > 2_000) {
    return { result: 'stale-observation', notification: 'A leitura da Jornada ficou desatualizada antes do clique. Nenhuma Marcação foi criada.' }
  }
  const decision = decidePunch(message.trigger, message.workDay, now)
  if (decision.result !== 'click') return decision
  const registration = decideRegistration(readRegistration())
  if (registration.result !== 'ready') return registration
  findPunchButton(document)!.click()
  return { result: 'clicked', at: now.getTime() }
}
