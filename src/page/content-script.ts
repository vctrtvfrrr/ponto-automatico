import { loadAutomation } from '../automation/storage.ts'
import { decideAttempt } from '../triggers/attempt.ts'
import { decidePunch, interruptedAttempt } from '../triggers/punch.ts'
import { CLICK_PUNCH, READ_REGISTRATION, READ_WORK_DAY, type ClickPunchMessage, type ClickPunchResponse, type PageMessage, type ReadWorkDayResponse, type RegistrationReport } from './messages.ts'
import { decideRegistration } from './observation.ts'
import { findPunchButtons, isLoginPage, readWorkDay } from './readers.ts'

let clickConsumed = false

chrome.runtime.onMessage.addListener((message: PageMessage, _sender, sendResponse: (response: ReadWorkDayResponse | RegistrationReport | ClickPunchResponse) => void) => {
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
    sendResponse({ status: 'login', observedAt: Date.now() })
    return
  }
  const workDay = location.pathname === '/meu-ponto' ? readWorkDay(document, message.date, new Date()) : undefined
  sendResponse(workDay ? { status: 'read', workDay, observedAt: Date.now() } : { status: 'unreadable', observedAt: Date.now() })
})

// Only the copy the current viewport lays out has a box; the other is display
// none. Visibility is deliberately not a gate: the Attempt's tab is never
// rendered, and the widget's entry animation leaves visibility hidden there.
function renderedPunchButtons(): HTMLButtonElement[] {
  return findPunchButtons(document).filter((button) => button.getClientRects().length > 0)
}

function punchButton(): HTMLButtonElement | undefined {
  const rendered = renderedPunchButtons()
  return rendered.length === 1 ? rendered[0] : undefined
}

function readRegistration(): RegistrationReport {
  const counts = { structural: findPunchButtons(document).length, rendered: renderedPunchButtons().length }
  if (isLoginPage(document)) return { observation: 'login', ...counts }
  if (location.pathname !== '/registrar-ponto') return { observation: 'missing', ...counts }
  const button = punchButton()
  if (!button) return { observation: 'missing', ...counts }
  const disabled = button.matches(':disabled') || button.closest('[aria-disabled="true"]')
  return { observation: disabled ? 'disabled' : 'ready', ...counts }
}

async function clickPunch(message: ClickPunchMessage): Promise<ClickPunchResponse> {
  const automation = await loadAutomation()
  const now = new Date()
  const attempt = decideAttempt(message.trigger, message.toleranceMinutes, now, automation)
  if (attempt.result !== 'ready' && attempt.result !== 'wait') return attempt
  if (attempt.result === 'wait' || now.getTime() < message.observedAt || now.getTime() - message.observedAt > 2_000) {
    return { result: 'stale-observation', reason: 'A leitura da Jornada ficou desatualizada antes do clique. Nenhuma Marcação foi criada.' }
  }
  const decision = decidePunch(message.trigger, message.workDay, now)
  if (decision.result !== 'click') return decision
  const registration = decideRegistration(readRegistration().observation)
  if (registration.result !== 'ready') return registration
  punchButton()!.click()
  return { result: 'clicked', at: now.getTime() }
}

