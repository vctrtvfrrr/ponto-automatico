import type { AutomationState } from '../automation/state.ts'
import { loadAutomation, saveAutomationEnabled } from '../automation/storage.ts'
import { GET_TODAY_WORK_DAY, type TodayWorkDayResponse, type WorkDaySnapshot } from '../page/messages.ts'
import { loadSchedule } from '../schedule/storage.ts'
import { GET_TODAY_TRIGGERS, type TodayTriggersResponse } from '../triggers/messages.ts'
import { localDate, type DailyTriggers } from '../triggers/plan.ts'
import { buildTimeline, punchInstants, type RowState, type TimelineRow } from './timeline.ts'

const LABELS: Record<RowState, string> = {
  fulfilled: 'cumprido',
  disabled: 'não será executado',
  next: '',
  future: '',
  awaiting: 'aguardando',
  failed: 'falhou',
  unplanned: 'sem Gatilho',
  unreconciled: '',
  unverified: 'sem leitura',
}

const manifest = chrome.runtime.getManifest()
document.querySelector('#name')!.textContent = manifest.name
document.querySelector('#version')!.textContent = manifest.version

const date = document.querySelector<HTMLTimeElement>('#date')!
const toggle = document.querySelector<HTMLButtonElement>('#automation')!
const automationError = document.querySelector<HTMLParagraphElement>('#automation-error')!
const timeline = document.querySelector<HTMLOListElement>('#timeline')!
const planStatus = document.querySelector<HTMLParagraphElement>('#plan-status')!
const readStatus = document.querySelector<HTMLParagraphElement>('#read-status')!
const observed = document.querySelector<HTMLParagraphElement>('#observed')!
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!

let automation: AutomationState | 'loading' | 'unavailable' = 'loading'
let toleranceMinutes = 0
let day: DailyTriggers | undefined
let snapshot: WorkDaySnapshot | undefined
let plan = 'Carregando Gatilhos…'
let read = ''
let punchDate = localDate(new Date())
let request = 0
let saving = false

async function loadDay(): Promise<void> {
  const current = ++request
  automation = 'loading'
  day = undefined
  plan = 'Carregando Gatilhos…'
  render()

  try {
    const [state, schedule] = await Promise.all([loadAutomation(), loadSchedule()])
    if (current !== request) return
    automation = state
    toleranceMinutes = schedule.toleranceMinutes
    if (!state.enabled) {
      plan = 'Nenhum Gatilho será executado. Ao religar, somente os Gatilhos futuros serão retomados.'
      render()
      return
    }

    const response: TodayTriggersResponse = await chrome.runtime.sendMessage({ type: GET_TODAY_TRIGGERS })
    if (current !== request) return
    if ('error' in response) throw new Error(response.error)
    day = response.day
    plan = !day || day.triggers.length === 0 ? 'Nenhum Gatilho previsto para hoje.' : ''
  } catch (error) {
    if (current !== request) return
    if (automation === 'loading') automation = 'unavailable'
    day = undefined
    plan = `${error instanceof Error ? error.message : 'Não foi possível carregar os Gatilhos.'} Reabra o popup para tentar novamente.`
  }
  render()
}

toggle.addEventListener('click', () => { void toggleAutomation() })

async function toggleAutomation(): Promise<void> {
  if (typeof automation !== 'object' || saving) return
  const enabled = !automation.enabled
  saving = true
  automationError.textContent = ''
  render()
  try {
    await saveAutomationEnabled(enabled)
    saving = false
    await loadDay()
  } catch {
    automationError.textContent = 'Não foi possível salvar. O estado da automação não foi alterado. Tente novamente.'
  } finally {
    saving = false
    render()
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.automation) void loadDay()
  if (changes.latestWorkDay) {
    adopt(changes.latestWorkDay.newValue as WorkDaySnapshot | undefined)
    render()
  }
})

refresh.addEventListener('click', () => { void refreshPunches() })

async function refreshPunches(): Promise<void> {
  if (refresh.disabled) return
  refresh.disabled = true
  punchDate = localDate(new Date())
  read = 'Lendo a Jornada no PontoMais…'
  render()
  try {
    const stored = await chrome.storage.local.get('latestWorkDay')
    adopt(stored.latestWorkDay as WorkDaySnapshot | undefined)
    render()

    const response: TodayWorkDayResponse = await chrome.runtime.sendMessage({ type: GET_TODAY_WORK_DAY })
    if ('error' in response) throw new Error(response.error)
    if (response.status === 'read') {
      adopt({ workDay: response.workDay, observedAt: response.observedAt })
      read = ''
    } else {
      read = response.status === 'login'
        ? 'Entre no PontoMais para atualizar as Marcações.'
        : 'Não foi possível ler a Jornada. Tente atualizar novamente.'
    }
  } catch {
    read = 'Não foi possível atualizar as Marcações. Tente novamente.'
  } finally {
    refresh.disabled = false
    render()
  }
}

function adopt(value: WorkDaySnapshot | undefined): void {
  snapshot = value?.workDay.date === localDate(new Date()) ? value : undefined
}

function render(): void {
  const now = new Date()
  const today = localDate(now)
  date.dateTime = today
  date.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

  if (punchDate !== today) void refreshPunches()
  if (day && day.date !== today) {
    void loadDay()
    return
  }
  if (snapshot && snapshot.workDay.date !== today) snapshot = undefined

  renderAutomation()
  timeline.replaceChildren(...buildTimeline({
    triggers: day?.triggers ?? [],
    punches: snapshot ? punchInstants(snapshot.workDay) : [],
    toleranceMinutes,
    now: now.getTime(),
    observedAt: snapshot?.observedAt,
    resumedAt: typeof automation === 'object' ? automation.resumedAt : undefined,
  }).map((row) => renderRow(row, now.getTime())))
  planStatus.textContent = plan
  readStatus.textContent = read
  observed.textContent = snapshot
    ? `Jornada lida às ${formatTime(snapshot.observedAt)}`
    : 'Jornada de hoje ainda não lida'
}

function renderAutomation(): void {
  const enabled = typeof automation === 'object' && automation.enabled
  toggle.setAttribute('aria-checked', String(enabled))
  toggle.disabled = saving || typeof automation !== 'object'
  toggle.textContent = saving ? 'Salvando…'
    : automation === 'loading' ? 'Automação: carregando…'
    : automation === 'unavailable' ? 'Automação indisponível'
    : enabled ? 'Automação ligada' : 'Automação desligada'
}

function renderRow({ at, state }: TimelineRow, now: number): HTMLLIElement {
  const item = document.createElement('li')
  item.dataset.state = state
  if (state === 'next') item.setAttribute('aria-current', 'true')

  const time = document.createElement('time')
  time.dateTime = new Date(at).toISOString()
  time.textContent = formatTime(at)
  item.append(time)

  const text = state === 'next' ? countdown(at, now) : LABELS[state]
  if (text) {
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = text
    item.append(label)
  }
  return item
}

function countdown(at: number, now: number): string {
  const minutes = Math.ceil((at - now) / 60_000)
  if (minutes <= 0) return 'agora'
  if (minutes < 60) return `em ${minutes} min`
  const rest = minutes % 60
  return rest === 0 ? `em ${minutes / 60} h` : `em ${Math.floor(minutes / 60)} h ${rest} min`
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

render()
void loadDay()
void refreshPunches()
window.setInterval(render, 1000)
