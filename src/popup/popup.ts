import type { AutomationState } from '../automation/state.ts'
import { loadAutomation, saveAutomationEnabled } from '../automation/storage.ts'
import { GET_TODAY_TRIGGERS, type TodayTriggersResponse } from '../triggers/messages.ts'
import { localDate, nextTrigger, type DailyTriggers } from '../triggers/plan.ts'

const { name: extensionName, version } = chrome.runtime.getManifest()

document.querySelector('#build')!.textContent = `${extensionName} ${version}`

const status = document.querySelector<HTMLParagraphElement>('#status')!
const times = document.querySelector<HTMLOListElement>('#triggers')!
const next = document.querySelector<HTMLParagraphElement>('#next')!
const date = document.querySelector<HTMLTimeElement>('#date')!
const automationStatus = document.querySelector<HTMLElement>('#automation-status strong')!
const toggle = document.querySelector<HTMLButtonElement>('#toggle-automation')!
const automationError = document.querySelector<HTMLParagraphElement>('#automation-error')!
let automation: AutomationState | undefined
let day: DailyTriggers | undefined
let request = 0
let saving = false

async function loadDay(): Promise<void> {
  const currentRequest = ++request
  day = undefined
  automation = undefined
  renderAutomation()
  status.textContent = 'Carregando Gatilhos…'
  times.replaceChildren()
  next.textContent = ''

  try {
    const current = await loadAutomation()
    if (currentRequest !== request) return
    automation = current
    renderAutomation()
    if (!automation.enabled) {
      status.textContent = 'Nenhum Gatilho será executado. Ao religar, somente os Gatilhos futuros serão retomados.'
      return
    }

    const response: TodayTriggersResponse = await chrome.runtime.sendMessage({ type: GET_TODAY_TRIGGERS })
    if (currentRequest !== request) return
    if ('error' in response) throw new Error(response.error)
    day = response.day
    status.textContent = !day || day.triggers.length === 0 ? 'Nenhum Gatilho previsto para hoje.' : ''
    render()
  } catch (error) {
    if (currentRequest !== request) return
    day = undefined
    status.textContent = `${error instanceof Error ? error.message : 'Não foi possível carregar os Gatilhos.'} Reabra o popup para tentar novamente.`
    if (!automation) automationStatus.textContent = 'Estado da automação indisponível.'
  }
}

function renderAutomation(): void {
  automationStatus.textContent = automation
    ? automation.enabled ? 'Automação ligada.' : 'Automação DESLIGADA.'
    : 'Carregando estado da automação…'
  toggle.textContent = saving ? 'Salvando…' : automation
    ? automation.enabled ? 'Desligar automação' : 'Ligar automação'
    : 'Carregando…'
  toggle.disabled = saving || !automation
}

toggle.addEventListener('click', () => {
  void toggleAutomation()
})

async function toggleAutomation(): Promise<void> {
  if (!automation || saving) return
  const enabled = !automation.enabled
  saving = true
  automationError.textContent = ''
  renderAutomation()
  try {
    await saveAutomationEnabled(enabled)
    await loadDay()
  } catch {
    automationError.textContent = 'Não foi possível salvar. O estado da automação não foi alterado. Tente novamente.'
  } finally {
    saving = false
    renderAutomation()
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.automation) void loadDay()
})

function render(): void {
  const now = new Date()
  date.dateTime = localDate(now)
  date.textContent = now.toLocaleDateString('pt-BR')
  if (!day) return
  if (day.date !== localDate(now)) {
    void loadDay()
    return
  }

  const upcoming = nextTrigger(day, now)
  times.replaceChildren(...day.triggers.map((trigger) => {
    const item = document.createElement('li')
    const time = document.createElement('time')
    time.dateTime = new Date(trigger.at).toISOString()
    time.textContent = formatTime(trigger.at)
    item.append(time)
    if (trigger === upcoming) {
      item.setAttribute('aria-current', 'true')
      item.append(' — próximo Gatilho')
    }
    return item
  }))
  next.textContent = upcoming
    ? `Próximo Gatilho: ${formatTime(upcoming.at)}.`
    : day.triggers.length > 0 ? 'Nenhum Gatilho restante hoje.' : ''
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

render()
void loadDay()
window.setInterval(render, 1000)
