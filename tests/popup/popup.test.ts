// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import popupPage from '../../src/popup/index.html?raw'
import { GET_TODAY_TRIGGERS } from '../../src/triggers/messages.ts'
import { GET_TODAY_WORK_DAY } from '../../src/page/messages.ts'

const date = '2026-09-09'
const now = new Date(2026, 8, 9, 13, 0)
const at = (hours: number, minutes: number) => new Date(2026, 8, 9, hours, minutes).getTime()

const get = vi.fn<(key: string) => Promise<Record<string, unknown>>>()
const set = vi.fn<() => Promise<void>>()
const sendMessage = vi.fn<(message: { type: string }) => Promise<unknown>>()
let stored: Record<string, unknown> = {}

function trigger(slot: number, hours: number, minutes: number) {
  return { slot, at: at(hours, minutes), window: { start: at(hours, minutes - 15), end: at(hours, minutes + 15) } }
}

function rows() {
  return Array.from(document.querySelectorAll('#timeline li')).map((item) => ({
    time: item.querySelector('time')!.textContent,
    state: (item as HTMLLIElement).dataset.state,
    label: item.querySelector('.label')?.textContent ?? '',
  }))
}

async function openPopup(): Promise<void> {
  await import('../../src/popup/popup.ts')
  await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: GET_TODAY_WORK_DAY }))
  await vi.waitFor(() => expect(document.querySelector<HTMLButtonElement>('#refresh')!.disabled).toBe(false))
}

beforeEach(() => {
  vi.useFakeTimers({ now, shouldAdvanceTime: true })
  stored = {
    latestWorkDay: { observedAt: at(12, 55), workDay: { date, punches: ['08:44', '10:00', '12:03'] } },
  }
  get.mockImplementation((key) => Promise.resolve({ [key]: stored[key] }))
  set.mockReset()
  set.mockResolvedValue()
  sendMessage.mockReset()
  sendMessage.mockImplementation((message) => Promise.resolve(
    message.type === GET_TODAY_WORK_DAY
      ? { status: 'read', observedAt: at(12, 55), workDay: { date, punches: ['08:44', '10:00', '12:03'] } }
      : { day: { date, triggers: [trigger(0, 8, 45), trigger(1, 12, 0), trigger(2, 12, 55), trigger(3, 18, 0)] } },
  ))
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(popupPage)![1]!
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ name: 'Ponto Automático', version: '0.6.0' }), sendMessage },
    storage: { local: { get, set }, onChanged: { addListener: vi.fn() } },
  })
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('shows one chronological list carrying a single time per line', async () => {
  await openPopup()

  expect(rows()).toEqual([
    { time: '08:44', state: 'fulfilled', label: 'cumprido' },
    { time: '10:00', state: 'unplanned', label: 'sem Gatilho' },
    { time: '12:03', state: 'fulfilled', label: 'cumprido' },
    { time: '12:55', state: 'awaiting', label: 'aguardando' },
    { time: '18:00', state: 'next', label: 'em 5 h' },
  ])
  expect(document.querySelector('[aria-current="true"] time')!.textContent).toBe('18:00')
  expect(document.body.textContent).not.toContain('Escala')
})

test('gives every line a textual label, never colour alone', async () => {
  sendMessage.mockReset()
  sendMessage.mockImplementation((message) => Promise.resolve(
    message.type === GET_TODAY_WORK_DAY
      ? { status: 'read', observedAt: at(12, 55), workDay: { date, punches: [] } }
      : { day: { date, triggers: [trigger(0, 8, 45), trigger(1, 12, 55)] } },
  ))

  await openPopup()

  expect(rows()).toEqual([
    { time: '08:45', state: 'failed', label: 'falhou' },
    { time: '12:55', state: 'awaiting', label: 'aguardando' },
  ])
})

test('drops every Trigger while the Automation is off and keeps today Punches', async () => {
  stored.automation = { enabled: false }

  await openPopup()

  expect(sendMessage).not.toHaveBeenCalledWith({ type: GET_TODAY_TRIGGERS })
  expect(rows()).toEqual([
    { time: '08:44', state: 'unreconciled', label: '' },
    { time: '10:00', state: 'unreconciled', label: '' },
    { time: '12:03', state: 'unreconciled', label: '' },
  ])
})

test('carries the Automation state in the switch label', async () => {
  const toggle = document.querySelector<HTMLButtonElement>('#automation')!
  await openPopup()
  expect(toggle.textContent!.trim()).toBe('Automação ligada')
  expect(toggle.getAttribute('aria-checked')).toBe('true')

  stored.automation = { enabled: false }
  vi.resetModules()
  await openPopup()
  expect(toggle.textContent!.trim()).toBe('Automação desligada')
  expect(toggle.getAttribute('aria-checked')).toBe('false')
})

test('reports a refused Automation write in the header', async () => {
  set.mockRejectedValue(new Error('Storage unavailable'))
  const toggle = document.querySelector<HTMLButtonElement>('#automation')!
  await openPopup()

  toggle.click()
  await vi.waitFor(() => expect(document.querySelector('#automation-error')!.textContent).toContain('Não foi possível salvar'))
  expect(toggle.textContent!.trim()).toBe('Automação ligada')
})

test('never calls a Trigger failed while today Jornada is unknown', async () => {
  stored.latestWorkDay = undefined
  sendMessage.mockImplementation((message) => Promise.resolve(
    message.type === GET_TODAY_WORK_DAY
      ? { status: 'login' }
      : { day: { date, triggers: [trigger(0, 8, 45), trigger(1, 12, 55)] } },
  ))

  await openPopup()

  expect(rows()).toEqual([
    { time: '08:45', state: 'unverified', label: 'sem leitura' },
    { time: '12:55', state: 'unverified', label: 'sem leitura' },
  ])
  expect(document.querySelector('#read-status')!.textContent).toContain('Entre no PontoMais')
  expect(document.querySelector('#observed')!.textContent).toBe('Jornada de hoje ainda não lida')
})
