// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import optionsPage from '../../src/options/index.html?raw'
import { DEFAULT_SCHEDULE } from '../../src/schedule/storage.ts'

const get = vi.fn<() => Promise<Record<string, unknown>>>()
const set = vi.fn()

beforeEach(() => {
  get.mockReset()
  set.mockClear()
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(optionsPage)![1]!
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ name: 'Ponto Automático', version: '0.1.0' }) },
    storage: { local: { get, set } },
  })
  vi.resetModules()
})

afterEach(() => vi.unstubAllGlobals())

function controls(): (HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement)[] {
  return Array.from(document.querySelectorAll('input, textarea, button'))
}

test('keeps the form locked until the stored Schedule has loaded', async () => {
  let finish!: (stored: Record<string, unknown>) => void
  get.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const loading = import('../../src/options/options.ts')
  await vi.waitFor(() => expect(get).toHaveBeenCalled())

  expect(controls().every((control) => control.disabled)).toBe(true)
  const submit = new Event('submit', { cancelable: true })
  document.querySelector('#schedule')!.dispatchEvent(submit)
  expect(submit.defaultPrevented).toBe(true)
  expect(set).not.toHaveBeenCalled()

  finish({ schedule: { ...DEFAULT_SCHEDULE, toleranceMinutes: 10, skipDates: ['2026-12-25'] } })
  await loading

  expect(controls().every((control) => !control.disabled)).toBe(true)
  expect(document.querySelector<HTMLInputElement>('#times-1')!.value).toBe('08:30, 12:00, 13:30, 18:00')
  expect(document.querySelector<HTMLInputElement>('#tolerance')!.value).toBe('10')
  expect(document.querySelector<HTMLTextAreaElement>('#skip-dates')!.value).toBe('2026-12-25')
  expect(set).not.toHaveBeenCalled()
})

test('opens the reference Schedule for editing on first use without saving it', async () => {
  get.mockResolvedValue({})

  await import('../../src/options/options.ts')

  expect(controls().every((control) => !control.disabled)).toBe(true)
  expect(document.querySelector<HTMLInputElement>('#times-1')!.value).toBe('08:30, 12:00, 13:30, 18:00')
  expect(set).not.toHaveBeenCalled()
})

test.each(['incompatible', 'null', 'refused'])('blocks editing after a %s read without overwriting data', async (failure) => {
  if (failure === 'refused') get.mockRejectedValue(new Error('Storage unavailable'))
  else get.mockResolvedValue({ schedule: failure === 'null' ? null : { times: {} } })

  await import('../../src/options/options.ts')

  const feedback = document.querySelector('#feedback')!
  expect(feedback.className).toBe('errors')
  expect(feedback.textContent).toContain('Não foi possível carregar a Escala')
  expect(feedback.textContent).toContain('recarregue a página')
  expect(feedback.textContent).toContain(failure === 'refused' ? 'Storage unavailable' : 'formato inválido')
  expect(controls().every((control) => control.disabled)).toBe(true)

  const submit = new Event('submit', { cancelable: true })
  document.querySelector('#schedule')!.dispatchEvent(submit)
  expect(submit.defaultPrevented).toBe(true)
  expect(feedback.className).toBe('errors')
  expect(set).not.toHaveBeenCalled()
})
