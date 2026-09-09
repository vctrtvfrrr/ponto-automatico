// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import optionsPage from '../../src/options/index.html?raw'

const WORKDAY = '08:30, 12:00, 13:30, 18:00'

let write: (items: Record<string, unknown>) => Promise<void>

beforeEach(async () => {
  write = async () => {}
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(optionsPage)![1]!

  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ name: 'Ponto Automático', version: '0.1.0' }) },
    storage: { local: { get: async () => ({}), set: (items: Record<string, unknown>) => write(items) } },
  })
  vi.resetModules()

  await import('../../src/options/options.ts')
})

async function save(values: Record<string, string> = {}): Promise<void> {
  for (const [selector, value] of Object.entries(values)) {
    document.querySelector<HTMLInputElement>(selector)!.value = value
  }

  document.querySelector('#schedule')!.dispatchEvent(new Event('submit', { cancelable: true }))
  await vi.waitFor(() => expect(document.querySelector('#feedback')!.className).not.toBe(''))
}

function feedback(): { tone: string; text: string } {
  const element = document.querySelector('#feedback')!

  return { tone: element.className, text: element.textContent ?? '' }
}

test('confirms a Schedule that reached the storage', async () => {
  await save({ '#times-1': WORKDAY, '#deviation': '15', '#tolerance': '15' })

  expect(feedback()).toEqual({ tone: 'saved', text: 'Escala salva.' })
})

test('never leaves the earlier confirmation standing when the write is refused', async () => {
  await save({ '#times-1': WORKDAY, '#deviation': '15', '#tolerance': '15' })

  write = async () => {
    throw new Error('QUOTA_BYTES quota exceeded')
  }
  await save({ '#tolerance': '30' })

  expect(feedback().tone).toBe('errors')
  expect(feedback().text).not.toContain('Escala salva.')
  expect(feedback().text).toContain('não foi salva')
  expect(feedback().text).toContain('QUOTA_BYTES quota exceeded')
})
