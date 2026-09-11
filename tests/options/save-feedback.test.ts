// @vitest-environment happy-dom
import { beforeEach, expect, test, vi } from 'vitest'
import optionsPage from '../../src/options/index.html?raw'

const WORKDAY = '08:30, 12:00, 13:30, 18:00'

let write: (items: Record<string, unknown>) => Promise<void>

beforeEach(async () => {
  write = async () => {}
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(optionsPage)![1]!
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')

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
  await vi.waitFor(() => expect(feedback().tone).toMatch(/^(saved|errors)$/))
}

function feedback(): { tone: string; text: string } {
  const element = document.querySelector('#feedback')!

  return { tone: element.className, text: element.textContent ?? '' }
}

test('confirms a Schedule that reached the storage', async () => {
  await save({ '#times-1': WORKDAY, '#deviation': '15', '#tolerance': '15' })

  expect(feedback()).toEqual({ tone: 'saved', text: 'Opções salvas.' })
})

test('never leaves the earlier confirmation standing when the write is refused', async () => {
  await save({ '#times-1': WORKDAY, '#deviation': '15', '#tolerance': '15' })

  write = async () => {
    throw new Error('QUOTA_BYTES quota exceeded')
  }
  await save({ '#tolerance': '30' })

  expect(feedback().tone).toBe('errors')
  expect(feedback().text).not.toContain('Opções salvas.')
  expect(feedback().text).toContain('Nada foi salvo')
  expect(feedback().text).toContain('QUOTA_BYTES quota exceeded')
})

test.each(['saved', 'errors'])('locks editing until a pending write ends with %s', async (outcome) => {
  let finish!: () => void
  const pending = new Promise<void>((resolve, reject) => {
    finish = outcome === 'saved' ? resolve : () => reject(new Error('Write refused'))
  })
  const store = vi.fn(() => pending)
  write = store

  const form = document.querySelector<HTMLFormElement>('#schedule')!
  const controls = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>(
    'input, textarea, button',
  )
  form.dispatchEvent(new Event('submit', { cancelable: true }))

  expect(feedback()).toEqual({ tone: 'saving', text: 'Salvando…' })
  expect(Array.from(controls).every((control) => control.disabled)).toBe(true)

  form.dispatchEvent(new Event('submit', { cancelable: true }))
  expect(store).toHaveBeenCalledTimes(1)
  expect(store).toHaveBeenCalledWith({
    schedule: expect.objectContaining({ times: expect.objectContaining({ 1: WORKDAY.split(', ') }) }),
    alerts: { topic: expect.stringMatching(/^ponto-automatico-[A-Za-z0-9]{16}$/) },
  })

  finish()
  await vi.waitFor(() => expect(feedback().tone).toBe(outcome))
  expect(Array.from(controls).every((control) => !control.disabled)).toBe(true)

  write = async () => {}
  await save({ '#tolerance': '30' })
  expect(feedback().tone).toBe('saved')
})

test.each([
  '#times-0', '#times-1', '#times-2', '#times-3', '#times-4', '#times-5', '#times-6',
  '#deviation', '#tolerance', '#skip-dates', '#topic',
])('clears the saved confirmation when %s is edited', async (selector) => {
  await save()

  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  field.value = ''
  field.dispatchEvent(new Event('input', { bubbles: true }))

  expect(feedback()).toEqual({ tone: '', text: '' })
})

test('rejects invalid edits without writing and leaves the form editable', async () => {
  const store = vi.fn(async () => {})
  write = store

  await save({ '#times-1': 'invalid' })

  expect(store).not.toHaveBeenCalled()
  expect(feedback().tone).toBe('errors')
  expect(document.querySelector<HTMLInputElement>('#times-1')!.disabled).toBe(false)
  expect(document.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false)
})

test('suggests a topic no one can guess, shown under a fixed ntfy.sh prefix', async () => {
  expect(document.querySelector('.prefixed .prefix')!.textContent).toBe('https://ntfy.sh/')

  const drawn = new Set<string>()
  for (let round = 0; round < 20; round++) {
    vi.resetModules()
    await import('../../src/options/options.ts')
    drawn.add(document.querySelector<HTMLInputElement>('#topic')!.value)
  }

  expect(drawn.size).toBe(20)
  for (const topic of drawn) expect(topic).toMatch(/^ponto-automatico-[A-Za-z0-9]{16}$/)
})

test('saves the Schedule and the topic in a single write', async () => {
  const store = vi.fn(write)
  write = store

  await save({ '#times-1': WORKDAY, '#deviation': '15', '#tolerance': '15', '#topic': 'meu-topico_1' })

  expect(store).toHaveBeenCalledTimes(1)
  expect(store).toHaveBeenCalledWith({ schedule: expect.anything(), alerts: { topic: 'meu-topico_1' } })
})

test('keeps an emptied topic empty instead of suggesting one again', async () => {
  const store = vi.fn(write)
  write = store

  await save({ '#topic': '  ' })

  expect(feedback().tone).toBe('saved')
  expect(store).toHaveBeenCalledWith(expect.objectContaining({ alerts: { topic: '' } }))
})

test.each(['meu topico', 'meu/topico', 'á', 'x'.repeat(65)])('refuses the topic %j without writing anything', async (topic) => {
  const store = vi.fn(async () => {})
  write = store

  await save({ '#topic': topic })

  expect(store).not.toHaveBeenCalled()
  expect(feedback().tone).toBe('errors')
  expect(feedback().text).toContain('não é válido')
  expect(feedback().text).toContain('letras, números, hífen e sublinhado')
})
