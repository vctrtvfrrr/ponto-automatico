import { GET_TODAY_TRIGGERS, type TodayTriggersResponse } from '../triggers/messages.ts'
import { localDate, nextTrigger, type DailyTriggers } from '../triggers/plan.ts'

const { name: extensionName, version } = chrome.runtime.getManifest()

document.querySelector('#build')!.textContent = `${extensionName} ${version}`

const status = document.querySelector<HTMLParagraphElement>('#status')!
const times = document.querySelector<HTMLOListElement>('#triggers')!
const next = document.querySelector<HTMLParagraphElement>('#next')!
const date = document.querySelector<HTMLTimeElement>('#date')!
let day: DailyTriggers | undefined
let loading = false

async function loadDay(): Promise<void> {
  if (loading) return
  loading = true
  status.textContent = 'Carregando Gatilhos…'
  times.replaceChildren()
  next.textContent = ''

  try {
    const response: TodayTriggersResponse = await chrome.runtime.sendMessage({ type: GET_TODAY_TRIGGERS })
    if ('error' in response) throw new Error(response.error)
    day = response.day
    status.textContent = day.triggers.length === 0 ? 'Nenhum Gatilho previsto para hoje.' : ''
    render()
  } catch (error) {
    day = undefined
    status.textContent = `${error instanceof Error ? error.message : 'Não foi possível carregar os Gatilhos.'} Reabra o popup para tentar novamente.`
  } finally {
    loading = false
  }
}

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
